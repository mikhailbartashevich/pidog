import { Alert, Box, Stack } from '@mui/material'
import { useState } from 'react'

import { useAiVision } from '../../hooks/useAiVision'
import { tr } from '../../lib/i18n'
import type { AiVisionPageProps } from '../../types/ui'
import { PageHeading } from '../ui/PageHeading'
import { VisionCameraCard } from '../vision/VisionCameraCard'
import { VisionDetectionList } from '../vision/VisionDetectionList'
import { VisionFaceMemoryCard } from '../vision/VisionFaceMemoryCard'
import { VisionMemoryControls } from '../vision/VisionMemoryControls'

export function AiVisionPage({
  language,
  connected,
  configured,
  streaming,
  streamNonce,
  settings,
  onCommand,
  onEnroll,
  onEnrollObject,
  onHead,
}: AiVisionPageProps) {
  const [livePreview, setLivePreview] = useState(false)
  const vision = useAiVision({
    connected,
    configured,
    streaming,
    settings,
    enrollFace: onEnroll,
    enrollObject: onEnrollObject,
  })

  return (
    <Stack sx={{ gap: 2 }}>
      <PageHeading
        language={language}
        eyebrow={tr(
          language,
          'PI 5 + AI HAT+ 2 · ОБНОВЛЕНИЕ ~0.9 С',
          'PI 5 + AI HAT+ 2 · UPDATES ~0.9 S',
        )}
        titleRu="AI-зрение и память"
        titleEn="AI vision & memory"
        descriptionRu="Нажмите рамку или находку под видео, затем сохраните имя. Список находок не меняет расположение контролов."
        descriptionEn="Tap a box or an item below the video, then save a name. The detection list does not move the controls."
      />
      {!configured && (
        <Alert severity="warning">
          {tr(
            language,
            'AI Pi ещё не подключён к Пайдогу.',
            'The AI Pi is not connected to PiDog yet.',
          )}
        </Alert>
      )}
      {vision.error && (
        <Alert severity="error" onClose={vision.clearError}>
          {vision.error}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 370px) minmax(0, 1fr)' },
          gap: { xs: 1.5, lg: 2 },
          alignItems: 'start',
        }}
      >
        <Stack
          sx={{
            gap: 1.2,
            minWidth: 0,
            order: { xs: 2, lg: 2 },
            position: { lg: 'sticky' },
            top: { lg: 82 },
          }}
        >
          <VisionCameraCard
            language={language}
            connected={connected}
            configured={configured}
            streaming={streaming}
            streamNonce={streamNonce}
            settings={settings}
            result={vision.result}
            selectedFace={vision.selectedFace}
            selectedObject={vision.selectedObject}
            refreshing={vision.refreshing}
            editing={vision.editing}
            livePreview={livePreview}
            onCommand={onCommand}
            onFaceSelect={vision.selectFace}
            onObjectSelect={vision.selectObject}
            onRefresh={() => void vision.refresh()}
            onLivePreviewToggle={() => setLivePreview((current) => !current)}
          />
          <VisionDetectionList
            language={language}
            items={vision.detections}
            selectedFace={vision.selectedFace}
            selectedObject={vision.selectedObject}
            onFace={vision.selectFace}
            onObject={vision.selectObject}
          />
        </Stack>
        <Stack sx={{ gap: 1.2, order: { xs: 1, lg: 1 } }}>
          <VisionFaceMemoryCard
            language={language}
            selectedFace={vision.selectedFace}
            names={vision.names}
            nameInput={vision.nameInput}
            saving={vision.saving}
            onNamesChange={vision.setNames}
            onNameInputChange={vision.setNameInput}
            onRemember={() => void vision.rememberFace()}
          />
          <VisionMemoryControls
            language={language}
            connected={connected}
            selectedObject={vision.selectedObject}
            objectName={vision.objectName}
            saving={vision.saving}
            onObjectName={vision.setObjectName}
            onRememberObject={() => void vision.rememberObject()}
            onHead={onHead}
          />
        </Stack>
      </Box>
    </Stack>
  )
}
