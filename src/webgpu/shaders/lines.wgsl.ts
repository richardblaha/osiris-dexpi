/**
 * WGSL Shader for Thick Orthogonal Lines (Pipelines, Signal lines) with Anti-aliasing and Jumpers
 */

export const LINES_WGSL = /* wgsl */ `
struct CameraUniforms {
    view_proj: mat4x4<f32>,
    viewport_size: vec2<f32>,
    zoom_level: f32,
    _padding: f32,
};

struct LineSegment {
    point_a: vec2<f32>,
    point_b: vec2<f32>,
    width_px: f32,
    style_flags: u32,  // 0: solid, 1: dashed, 2: dotted, bit 4 (16): jumper
    entity_id: u32,
    _pad0: u32,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> lines: array<LineSegment>;

struct LineVertexOutput {
    @builtin(position) clip_pos: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) @interpolate(flat) entity_id: u32,
    @location(2) uv: vec2<f32>, // x: distance along line in px, y: offset from center [-1.0, 1.0]
    @location(3) @interpolate(flat) style_flags: u32,
    @location(4) line_length_px: f32,
};

// Generates an extruded ribbon quad for each line segment instance (6 vertices: 2 triangles)
@vertex
fn vs_thick_line(
    @builtin(vertex_index) vertex_idx: u32,
    @builtin(instance_index) segment_idx: u32
) -> LineVertexOutput {
    let seg = lines[segment_idx];

    // Project endpoints to screen space
    let clip_a = camera.view_proj * vec4<f32>(seg.point_a, 0.0, 1.0);
    let clip_b = camera.view_proj * vec4<f32>(seg.point_b, 0.0, 1.0);

    let ndc_a = clip_a.xy / clip_a.w;
    let ndc_b = clip_b.xy / clip_b.w;

    let screen_a = (ndc_a * 0.5 + vec2<f32>(0.5)) * camera.viewport_size;
    let screen_b = (ndc_b * 0.5 + vec2<f32>(0.5)) * camera.viewport_size;

    let delta = screen_b - screen_a;
    let len = max(length(delta), 0.0001);
    let dir = delta / len;
    let normal = vec2<f32>(-dir.y, dir.x);

    // Half width with 1px border for analytic anti-aliasing feathering
    let half_width = (seg.width_px * 0.5) + 1.0;

    // Triangle list quad vertex mapping (0, 1, 2, 2, 1, 3)
    var is_b = false;
    var is_right = false;

    if (vertex_idx == 0u) {
        is_b = false; is_right = false;
    } else if (vertex_idx == 1u) {
        is_b = false; is_right = true;
    } else if (vertex_idx == 2u) {
        is_b = true;  is_right = false;
    } else if (vertex_idx == 3u) {
        is_b = true;  is_right = false;
    } else if (vertex_idx == 4u) {
        is_b = false; is_right = true;
    } else { // 5u
        is_b = true;  is_right = true;
    }

    let base_screen = select(screen_a, screen_b, is_b);
    let side = select(-1.0, 1.0, is_right);

    // Butt cap extrusion along direction to prevent gaps at joints
    let cap_extension = select(-1.0, 1.0, is_b) * (half_width * 0.5);
    let offset_screen = base_screen + (normal * (side * half_width)) + (dir * cap_extension);

    // Back to NDC and clip coordinates
    let out_ndc = (offset_screen / camera.viewport_size - vec2<f32>(0.5)) * 2.0;
    let w_val = select(clip_a.w, clip_b.w, is_b);

    var out: LineVertexOutput;
    out.clip_pos = vec4<f32>(out_ndc * w_val, 0.0, w_val);
    out.color = seg.color;
    out.entity_id = seg.entity_id;
    out.uv = vec2<f32>(select(0.0, len, is_b), side);
    out.style_flags = seg.style_flags;
    out.line_length_px = len;
    return out;
}

@fragment
fn fs_thick_line(in: LineVertexOutput) -> @location(0) vec4<f32> {
    // Analytic anti-aliasing across stroke width
    let dist_from_center = abs(in.uv.y);
    let alpha_feather = 1.0 - smoothstep(0.7, 1.0, dist_from_center);

    var dash_alpha = 1.0;
    let style_type = in.style_flags & 0x0Fu;

    if (style_type == 1u) {
        // Dashed: 12px dash, 8px gap
        let pattern_pos = in.uv.x % 20.0;
        if (pattern_pos > 12.0) {
            dash_alpha = 0.0;
        }
    } else if (style_type == 2u) {
        // Dotted: 4px dot, 6px gap
        let pattern_pos = in.uv.x % 10.0;
        if (pattern_pos > 4.0) {
            dash_alpha = 0.0;
        }
    }

    let total_alpha = in.color.a * alpha_feather * dash_alpha;
    if (total_alpha <= 0.01) {
        discard;
    }

    return vec4<f32>(in.color.rgb, total_alpha);
}
`;

