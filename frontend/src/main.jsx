import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import './index.css'
import App from './App.jsx'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      50: '#eef6ff',
      100: '#d9ebff',
      200: '#b8dcff',
      300: '#8cc8ff',
      400: '#5aa9f5',
      500: '#2f80ed',
      600: '#1f6feb',
      700: '#185abc',
      800: '#174a94',
      900: '#153f7a',
      main: '#1f6feb',
      light: '#5aa9f5',
      dark: '#185abc',
      contrastText: '#ffffff',
    },
    secondary: {
      50: '#ecfdf3',
      100: '#d1fae0',
      200: '#a7f3c1',
      300: '#6ee798',
      400: '#39d474',
      500: '#20b85a',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      main: '#16a34a',
      light: '#39d474',
      dark: '#15803d',
      contrastText: '#ffffff',
    },
    neutral: {
      0: '#ffffff',
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    status: {
      success: {
        bg: '#dcfce7',
        border: '#86efac',
        text: '#166534',
      },
      pending: {
        bg: '#fef3c7',
        border: '#fcd34d',
        text: '#92400e',
      },
      revised: {
        bg: '#e0f2fe',
        border: '#7dd3fc',
        text: '#075985',
      },
      waitingConnection: {
        bg: '#ede9fe',
        border: '#c4b5fd',
        text: '#5b21b6',
      },
      actionRequired: {
        bg: '#ffedd5',
        border: '#fdba74',
        text: '#9a3412',
      },
      rejected: {
        bg: '#fee2e2',
        border: '#fca5a5',
        text: '#991b1b',
      },
    },
    actionType: {
      information: {
        main: '#2563eb',
        hover: '#1d4ed8',
        subtle: '#dbeafe',
        text: '#1e40af',
      },
      confirm: {
        main: '#16a34a',
        hover: '#15803d',
        subtle: '#dcfce7',
        text: '#166534',
      },
      reject: {
        main: '#dc2626',
        hover: '#b91c1c',
        subtle: '#fee2e2',
        text: '#991b1b',
      },
      warning: {
        main: '#d97706',
        hover: '#b45309',
        subtle: '#fef3c7',
        text: '#92400e',
      },
      submit: {
        main: '#0f766e',
        hover: '#115e59',
        subtle: '#ccfbf1',
        text: '#134e4a',
      },
      draft: {
        main: '#64748b',
        hover: '#475569',
        subtle: '#f1f5f9',
        text: '#334155',
      },
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    divider: '#e2e8f0',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Kanit, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeightLight: 300,
    fontWeightRegular: 300,
    fontWeightMedium: 300,
    fontWeightBold: 600,
    allVariants: {
      fontWeight: 300,
    },
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 300,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontWeight: 300,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
        },
      },
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
