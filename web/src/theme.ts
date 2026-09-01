import { alpha, createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#18d5ff',
      light: '#7be9ff',
      dark: '#00a6cf',
      contrastText: '#00151d',
    },
    secondary: {
      main: '#a78bfa',
    },
    success: {
      main: '#45e6a4',
    },
    warning: {
      main: '#ffbe55',
    },
    error: {
      main: '#ff5a6b',
    },
    background: {
      default: '#030a12',
      paper: '#081723',
    },
    text: {
      primary: '#eefaff',
      secondary: '#88a9b8',
    },
    divider: alpha('#55dfff', 0.14),
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily:
      'Inter, Manrope, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    h1: {
      fontSize: 'clamp(2rem, 5vw, 4rem)',
      lineHeight: 0.98,
      fontWeight: 750,
      letterSpacing: '-0.055em',
    },
    h2: {
      fontSize: 'clamp(1.7rem, 3vw, 2.5rem)',
      fontWeight: 700,
      letterSpacing: '-0.035em',
    },
    h3: {
      fontSize: '1.2rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'dark',
        },
        body: {
          minWidth: 320,
          minHeight: '100vh',
          backgroundImage:
            'radial-gradient(circle at 80% -10%, rgba(19, 207, 244, 0.14), transparent 35%), radial-gradient(circle at -10% 80%, rgba(124, 77, 255, 0.1), transparent 35%)',
          backgroundAttachment: 'fixed',
        },
        '*': {
          boxSizing: 'border-box',
        },
        '::selection': {
          color: '#00151d',
          backgroundColor: '#7be9ff',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          minHeight: 44,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha('#65dfff', 0.13)}`,
          boxShadow: '0 22px 60px rgba(0, 3, 8, 0.24)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'linear-gradient(145deg, #0b1c2a, #06111b)',
          border: `1px solid ${alpha('#65dfff', 0.18)}`,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
    },
  },
})
