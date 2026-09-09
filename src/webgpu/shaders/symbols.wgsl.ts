/**
 * WGSL Shader for Instanced P&ID Parametric Symbols
 */

export const SYMBOLS_WGSL = /* wgsl */ `
struct CameraUniforms {
    view_proj: mat4x4<f32>,     // 64 bytes
    viewport_size: vec2<f32>,   // 8 bytes
    zoom_level: f32,            // 4 bytes
    _padding: f32,              // 4 bytes
};

struct SymbolInstance {
    transform_row0: vec4<f32>,  // [m00, m01, 0.0, tx]
    transform_row1: vec4<f32>,  // [m10, m11, 0.0, ty]
    color_primary: vec4<f32>,   // RGBA
    color_secondary: vec4<f32>, // RGBA fill
    symbol_type_id: u32,
    flags: u32,                 // bit 0: selected, bit 1: hovered, bit 2: mirrorX, bit 3: mirrorY
    entity_id: u32,
    lod_min_zoom: f32,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> instances: array<SymbolInstance>;

struct VertexInput {
    @location(0) local_pos: vec2<f32>,
    @location(1) is_stroke: f32, // 1.0 if boundary stroke, 0.0 if fill
    @builtin(instance_index) instance_idx: u32,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) @interpolate(flat) entity_id: u32,
    @location(2) uv: vec2<f32>,
};

@vertex
fn vs_symbol_main(in: VertexInput) -> VertexOutput {
    let inst = instances[in.instance_idx];

    // Culling by zoom level if required
    if (camera.zoom_level < inst.lod_min_zoom) {
        // Move outside clip space to cull in vertex shader
        var culled: VertexOutput;
        culled.clip_position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
        return culled;
    }

    var pos = in.local_pos;

    // Apply mirroring flags
    if ((inst.flags & 4u) != 0u) {
        pos.x = -pos.x;
    }
    if ((inst.flags & 8u) != 0u) {
        pos.y = -pos.y;
    }

    // Affine 2D transformation: World = Matrix * Local + Translate
    let world_x = inst.transform_row0.x * pos.x + inst.transform_row0.y * pos.y + inst.transform_row0.w;
    let world_y = inst.transform_row1.x * pos.x + inst.transform_row1.y * pos.y + inst.transform_row1.w;

    var out_color = select(inst.color_secondary, inst.color_primary, in.is_stroke > 0.5);

    // Selection highlight (orange accent)
    if ((inst.flags & 1u) != 0u) {
        out_color = vec4<f32>(1.0, 0.55, 0.0, 1.0);
    } else if ((inst.flags & 2u) != 0u) {
        // Hover tint (cyan accent)
        out_color = mix(out_color, vec4<f32>(0.0, 0.95, 1.0, 1.0), 0.6);
    }

    var out: VertexOutput;
    out.clip_position = camera.view_proj * vec4<f32>(world_x, world_y, 0.0, 1.0);
    out.color = out_color;
    out.entity_id = inst.entity_id;
    out.uv = in.local_pos + vec2<f32>(0.5);
    return out;
}

@fragment
fn fs_symbol_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return in.color;
}
`;

