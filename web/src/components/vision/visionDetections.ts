import type { VisionFace, VisionInferenceResponse, VisionObject } from '../../lib/api'

export type VisionDetection =
  | { id: string; kind: 'face'; value: VisionFace }
  | { id: string; kind: 'object'; value: VisionObject }

function faceId(face: VisionFace, index: number) {
  return face.name ?? face.names?.join('/') ?? String(index)
}

export function mergeVisionDetections(current: VisionDetection[], result: VisionInferenceResponse) {
  const incoming: VisionDetection[] = [
    ...result.faces.map((value, index) => ({
      id: `face:${faceId(value, index)}`,
      kind: 'face' as const,
      value,
    })),
    ...result.objects.map((value) => ({
      id: `object:${value.name ?? value.label}`,
      kind: 'object' as const,
      value,
    })),
  ]
  return incoming.reduce<VisionDetection[]>((history, next) => {
    const index = history.findIndex((item) => item.id === next.id)
    if (index === -1) return [...history, next].slice(-12)
    return history.map((item, itemIndex) => (itemIndex === index ? next : item))
  }, current)
}
