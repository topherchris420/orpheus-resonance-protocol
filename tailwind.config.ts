import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				gold: {
					400: '#fbbf24',
					500: '#f59e0b',
					900: '#78350f'
				},
				o: {
					bg: 'hsl(var(--o-bg) / <alpha-value>)',
					s1: 'hsl(var(--o-surface-1) / <alpha-value>)',
					s2: 'hsl(var(--o-surface-2) / <alpha-value>)',
					s3: 'hsl(var(--o-surface-3) / <alpha-value>)',
					line: 'hsl(var(--o-line) / <alpha-value>)',
					'line-strong': 'hsl(var(--o-line-strong) / <alpha-value>)',
					text: 'hsl(var(--o-text) / <alpha-value>)',
					text2: 'hsl(var(--o-text-2) / <alpha-value>)',
					text3: 'hsl(var(--o-text-3) / <alpha-value>)',
					teal: 'hsl(var(--o-teal) / <alpha-value>)',
					'teal-strong': 'hsl(var(--o-teal-strong) / <alpha-value>)',
					'teal-dim': 'hsl(var(--o-teal-dim) / <alpha-value>)',
					amber: 'hsl(var(--o-amber) / <alpha-value>)',
					red: 'hsl(var(--o-red) / <alpha-value>)',
					violet: 'hsl(var(--o-violet) / <alpha-value>)',
					sky: 'hsl(var(--o-sky) / <alpha-value>)'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
