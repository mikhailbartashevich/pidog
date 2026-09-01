import { Box, Typography } from '@mui/material'

import type { Language } from '../../lib/commands'
import { tr } from '../../lib/i18n'

type PageHeadingProps = {
  language: Language
  eyebrow: string
  titleRu: string
  titleEn: string
  descriptionRu: string
  descriptionEn: string
}

export function PageHeading({
  language,
  eyebrow,
  titleRu,
  titleEn,
  descriptionRu,
  descriptionEn,
}: PageHeadingProps) {
  return (
    <Box>
      <Typography
        variant="overline"
        color="primary.main"
        sx={{ fontWeight: 800, letterSpacing: '.12em' }}
      >
        {eyebrow}
      </Typography>
      <Typography variant="h2" sx={{ mt: 0.2 }}>
        {tr(language, titleRu, titleEn)}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 780, lineHeight: 1.55 }}>
        {tr(language, descriptionRu, descriptionEn)}
      </Typography>
    </Box>
  )
}
