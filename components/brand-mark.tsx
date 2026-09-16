export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
    >
      <path d="M9 25.2c0-5.1 4-9.2 9-9.2 1.5-5 6.1-8.5 11.5-8.5 6.7 0 12 5.2 12 11.7v.7c3.1.9 5.4 3.8 5.4 7.3 0 4.3-3.5 7.8-7.8 7.8H17.2C12.7 35 9 30.6 9 25.2Z" fill="#BEE8F2" />
      <path d="M9 25.2c0-5.1 4-9.2 9-9.2 1.5-5 6.1-8.5 11.5-8.5 6.7 0 12 5.2 12 11.7v.7c3.1.9 5.4 3.8 5.4 7.3 0 4.3-3.5 7.8-7.8 7.8H17.2C12.7 35 9 30.6 9 25.2Z" stroke="#176B91" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M17 30.5c1.5 3.5 2.5 5.7 4.4 8.7M25 30.5c1.5 3.5 2.5 5.7 4.4 8.7M33 30.5c1.5 3.5 2.5 5.7 4.4 8.7" stroke="#176B91" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="30.4" cy="12.5" r="1.7" fill="#E6AB50" />
    </svg>
  );
}
