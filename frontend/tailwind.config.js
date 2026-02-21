/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                savvy: {
                    bg: '#0F172A',
                    glass: 'rgba(255, 255, 255, 0.05)',
                    border: 'rgba(255, 255, 255, 0.1)',
                    purple: '#A855F7',
                    gold: '#F59E0B',
                    green: '#10B981'
                }
            }
        },
    },
    plugins: [],
}
