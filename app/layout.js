import "./globals.css";

export const metadata = {
  title: "TestBank Pro",
  description: "AI-powered exam question generator for college math",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"
        />
        <script
          src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"
          defer
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
