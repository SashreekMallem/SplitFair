export type Theme = {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
    success: string;
    error: string;
    warning: string;
  };
  spacing: {
    xs: number;
    s: number;
    m: number;
    l: number;
    xl: number;
  };
  borderRadius: {
    s: number;
    m: number;
    l: number;
  };
};

export const lightTheme: Theme = {
  colors: {
    primary: '#546DE5',
    secondary: '#778BEB',
    background: '#FFFFFF',
    card: '#F5F5F5',
    text: '#333333',
    border: '#DDDDDD',
    notification: '#FF4757',
    success: '#20BF6B',
    error: '#EB4D4B',
    warning: '#F0932B',
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 16,
  },
};

export const darkTheme: Theme = {
  colors: {
    primary: '#778BEB',
    secondary: '#546DE5',
    background: '#121212',
    card: '#1E1E1E',
    text: '#F5F5F5',
    border: '#333333',
    notification: '#FF4757',
    success: '#20BF6B',
    error: '#EB4D4B',
    warning: '#F0932B',
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 16,
  },
};
