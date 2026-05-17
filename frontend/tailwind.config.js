/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: ['./index.html', './src/**/*.{ts,js,vue}'],
	theme: {
		extend: {
			// Apple radius scale：rounded.none/sm/md/lg/pill 四档（外加 shadcn 兼容）
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'apple-sm': '8px',
				'apple-md': '11px',
				'apple-lg': '18px',
				'apple-pill': '9999px',
			},
			// Apple spacing tokens（4/8/12/17/24/32/48/80）
			spacing: {
				'apple-xxs': '4px',
				'apple-xs': '8px',
				'apple-sm': '12px',
				'apple-md': '17px',
				'apple-lg': '24px',
				'apple-xl': '32px',
				'apple-xxl': '48px',
				'apple-section': '80px',
			},
			colors: {
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					1: 'hsl(var(--chart-1))',
					2: 'hsl(var(--chart-2))',
					3: 'hsl(var(--chart-3))',
					4: 'hsl(var(--chart-4))',
					5: 'hsl(var(--chart-5))',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))',
				},
				// Apple 原生命名色（命名遵循文档 token，便于 grep 对照）
				apple: {
					blue: '#0066cc',
					'blue-focus': '#0071e3',
					'blue-sky': '#2997ff',
					ink: '#1d1d1f',
					'ink-80': '#333333',
					'ink-48': '#7a7a7a',
					canvas: '#ffffff',
					parchment: '#f5f5f7',
					pearl: '#fafafc',
					tile: '#272729',
					'tile-2': '#2a2a2c',
					'tile-3': '#252527',
					hairline: '#e0e0e0',
					divider: '#f0f0f0',
					'body-muted': '#cccccc',
				},
			},
			fontFamily: {
				// 显示用字体（标题）—— SF Pro Display 优先
				display: [
					'-apple-system',
					'BlinkMacSystemFont',
					'"SF Pro Display"',
					'"Inter Variable"',
					'Inter',
					'system-ui',
					'"PingFang SC"',
					'"Microsoft YaHei"',
					'sans-serif',
				],
				// 正文 —— SF Pro Text 优先
				sans: [
					'-apple-system',
					'BlinkMacSystemFont',
					'"SF Pro Text"',
					'"SF Pro Display"',
					'"Inter Variable"',
					'Inter',
					'system-ui',
					'"PingFang SC"',
					'"Microsoft YaHei"',
					'sans-serif',
				],
			},
			// Apple typography 预设：直接用 text-hero/text-display-lg/text-lead 等
			fontSize: {
				hero: [
					'56px',
					{ lineHeight: '1.07', letterSpacing: '-0.005em', fontWeight: '600' },
				],
				'display-lg': [
					'40px',
					{ lineHeight: '1.1', letterSpacing: '0', fontWeight: '600' },
				],
				'display-md': [
					'34px',
					{ lineHeight: '1.15', letterSpacing: '-0.011em', fontWeight: '600' },
				],
				lead: [
					'28px',
					{ lineHeight: '1.14', letterSpacing: '0.007em', fontWeight: '400' },
				],
				'lead-airy': [
					'24px',
					{ lineHeight: '1.5', letterSpacing: '0', fontWeight: '300' },
				],
				tagline: [
					'21px',
					{ lineHeight: '1.19', letterSpacing: '0.011em', fontWeight: '600' },
				],
				'body-strong': [
					'17px',
					{ lineHeight: '1.24', letterSpacing: '-0.022em', fontWeight: '600' },
				],
				body: [
					'17px',
					{ lineHeight: '1.47', letterSpacing: '-0.022em', fontWeight: '400' },
				],
				caption: [
					'14px',
					{ lineHeight: '1.43', letterSpacing: '-0.016em', fontWeight: '400' },
				],
				'caption-strong': [
					'14px',
					{ lineHeight: '1.29', letterSpacing: '-0.016em', fontWeight: '600' },
				],
				'fine-print': [
					'12px',
					{ lineHeight: '1.0', letterSpacing: '-0.01em', fontWeight: '400' },
				],
				'micro-legal': [
					'10px',
					{ lineHeight: '1.3', letterSpacing: '-0.008em', fontWeight: '400' },
				],
				'nav-link': [
					'12px',
					{ lineHeight: '1.0', letterSpacing: '-0.01em', fontWeight: '400' },
				],
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
};
