/**
 * WGSL Shader for Zoom-Independent MSDF (Multi-channel Signed Distance Field) Text Rendering
 */

export const TEXT_WGSL = /* wgsl */ `
struct CameraUniforms {
    view_proj: mat4x4<f32>,
    viewport_size: vec2<f32>,
    zoom_level: f32,
    _padding: f32,
};

struct TextGlyph {
    pos_min: vec2<f32>,          // World-space (x0, y0)
    pos_max: vec2<f32>,          // World-space (x1, y1)
    uv_min: vec2<f32>,           // Atlas UV (u0, v0)
    uv_max: vec2<f32>,           // Atlas UV (u1, v1)
    color: vec4<f32>,            // RGBA text color
    font_size: f32,              // Target font size in world units
    entity_id: u32,
    _pad: vec2<u32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> glyphs: array<TextGlyph>;
@group(0) @binding(2) var msdf_atlas: texture_2d<f32>;
@group(0) @binding(3) var msdf_sampler: sampler;

struct TextVertexOutput {
    @builtin(position) clip_pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) screen_px_size: f32,
    @location(3) @interpolate(flat) entity_id: u32,
};

fn median3(r: f32, g: f32, b: f32) -> f32 {
    return max(min(r, g), min(max(r, g), b));
}

@vertex
fn vs_msdf_text(
    @builtin(vertex_index) vertex_idx: u32,
    @builtin(instance_index) glyph_idx: u32
) -> TextVertexOutput {
    let glyph = glyphs[glyph_idx];

    // Compute effective screen pixel size of this glyph
    let screen_px_size = glyph.font_size * camera.zoom_level;

    // Triangle strip/list quad index mapping (0: min,min; 1: max,min; 2: min,max; 3: min,max; 4: max,min; 5: max,max)
    var is_x_max = false;
    var is_y_max = false;

    if (vertex_idx == 0u) {
        is_x_max = false; is_y_max = false;
    } else if (vertex_idx == 1u) {
        is_x_max = true;  is_y_max = false;
    } else if (vertex_idx == 2u) {
        is_x_max = false; is_y_max = true;
    } else if (vertex_idx == 3u) {
        is_x_max = false; is_y_max = true;
    } else if (vertex_idx == 4u) {
        is_x_max = true;  is_y_max = false;
    } else { // 5u
        is_x_max = true;  is_y_max = true;
    }

    let world_pos = vec2<f32>(
        select(glyph.pos_min.x, glyph.pos_max.x, is_x_max),
        select(glyph.pos_min.y, glyph.pos_max.y, is_y_max)
    );

    let uv = vec2<f32>(
        select(glyph.uv_min.x, glyph.uv_max.x, is_x_max),
        select(glyph.uv_min.y, glyph.uv_max.y, is_y_max)
    );

    var out: TextVertexOutput;
    out.clip_pos = camera.view_proj * vec4<f32>(world_pos, 0.0, 1.0);
    out.uv = uv;
    out.color = glyph.color;
    out.screen_px_size = screen_px_size;
    out.entity_id = glyph.entity_id;
    return out;
}

@fragment
fn fs_msdf_text(in: TextVertexOutput) -> @location(0) vec4<f32> {
    // 1. Greeking LOD: Below 4px screen size, render placeholder bars to save fragment shading
    if (in.screen_px_size < 4.0) {
        return vec4<f32>(in.color.rgb, in.color.a * 0.3);
    }

    // 2. Sample MSDF texture
    let msd = textureSample(msdf_atlas, msdf_sampler, in.uv).rgb;
    let sd = median3(msd.r, msd.g, msd.b) - 0.5;

    // 3. Screen-space distance conversion for sharp vector rendering
    let screen_dist = sd * in.screen_px_size;
    let alpha = clamp(screen_dist + 0.5, 0.0, 1.0);

    if (alpha <= 0.01) {
        discard;
    }

    return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
`;

