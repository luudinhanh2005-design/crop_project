/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js}",
    "./*.html",
    "./app_premium_v3.js"
  ],
  theme: {
    extend: {
      colors: {
        agrisocial: {
          primary: '#00B14F', // Xanh lá thương hiệu từ Logo
          secondary: '#008F3E', // Xanh đậm hơn cho hover/active
          light: '#E6F7ED', // Xanh nhạt cho background active items
          hover: '#F0FFF4', // Hover state nhẹ
        },
        accent: {
          orange: '#FF8A00', // Màu cam cho các tag nổi bật (lúa, ngô)
          red: '#FF4D4D',    // Màu đỏ cho thông báo, logout
          yellow: '#FFC700', // Màu vàng cho chuyên gia, badge
          blue: '#377DFF',   // Màu xanh dương cho link hoặc verified
          purple: '#9B51E0', // Màu tím cho các hạng mục đóng góp
        },
        neutral: {
          100: '#F8F9FA', // Background chính của app
          200: '#F4F4F4', // Background nhẹ cho input/search
          300: '#E6E8EC', // Border màu nhẹ
          400: '#B1B5C3', // Text placeholder
          500: '#777E90', // Text secondary (caption, meta info)
          600: '#353945', // Text body
          700: '#23262F', // Text heading
          800: '#141416', // Deep black cho UI elements
        }
      },
      fontFamily: {
        'sans': ['Inter', 'Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'card': '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        'premium': '0 20px 40px rgba(0, 0, 0, 0.03)',
      },
      backgroundImage: {
        'gradient-green': 'linear-gradient(135deg, #00B14F 0%, #008F3E 100%)',
      }
    },
  },
  plugins: [],
}
