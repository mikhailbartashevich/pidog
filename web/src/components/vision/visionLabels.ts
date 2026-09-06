import type { VisionBox, VisionFace, VisionObject } from '../../lib/api'
import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'

export function visionBoxKey(box: VisionBox) {
  return `${box.x}-${box.y}-${box.w}-${box.h}`
}

export function visionFaceLabel(face: VisionFace, language: Language) {
  const names = face.names?.length ? face.names : face.name ? [face.name] : []
  return names.length ? names.join(' / ') : tr(language, 'Неизвестное лицо', 'Unknown face')
}

export function visionObjectLabel(object: VisionObject, language: Language) {
  if (object.name) return object.name
  if (object.label) return `${object.label} · ${Math.round((object.score ?? 0) * 100)}%`
  return tr(language, 'Предмет', 'Object')
}
