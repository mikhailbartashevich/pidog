import {
  Avatar,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
  alpha,
} from '@mui/material'
import type { ReactNode } from 'react'

export function CompactMetric({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <Card>
      <CardContent sx={{ p: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap>
              {label.toUpperCase()}
            </Typography>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.15 }} noWrap>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function SensorMetric({
  icon,
  title,
  value,
  detail,
  color,
  progress,
}: {
  icon: ReactNode
  title: string
  value: string
  detail: string
  color: string
  progress?: number
}) {
  return (
    <Card>
      <CardContent sx={{ p: 2.4 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Avatar sx={{ bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
            {title.toUpperCase()}
          </Typography>
        </Stack>
        <Typography sx={{ mt: 2, fontSize: { xs: '1.5rem', sm: '1.9rem' }, fontWeight: 800 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
        {progress != null && (
          <LinearProgress
            variant="determinate"
            value={progress}
            color={progress < 20 ? 'error' : 'success'}
            sx={{ mt: 1.5, height: 5, borderRadius: 2 }}
          />
        )}
      </CardContent>
    </Card>
  )
}
