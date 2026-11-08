export function ConditionArt({ kind, band }: { kind: string; band: number }) {
  const level = Math.max(0, band);
  return (
    <svg
      className="condition-art"
      viewBox="0 0 120 110"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-state={band}
    >
      {kind === "heat" ? (
        <>
          {level < 2 && (
            <>
              <circle cx="46" cy="37" r="18" fill="#f5bd55" />
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <path
                  key={angle}
                  transform={"rotate(" + angle + " 46 37)"}
                  d="M46 9V3"
                />
              ))}
            </>
          )}
          {level > 0 && (
            <path
              d="M29 69C9 66 12 40 32 42c4-28 44-28 47-2 28-4 33 30 9 30Z"
              fill="#dce9ef"
            />
          )}
          {level === 3 && <path d="m36 82-4 10m28-10-4 10m28-10-4 10" />}
          {level === 4 && <path d="m65 74-16 17h13l-9 15" stroke="#986413" />}
          {level === 5 && (
            <path d="M40 79v20m-9-15 18 10m0-10-18 10m44-15v20m-9-15 18 10m0-10-18 10" />
          )}
        </>
      ) : kind === "water" ? (
        <>
          <path d="M12 86q24-10 48 0t48 0v16H12Z" fill="#d3b183" />
          {level === 0 && <path d="m45 84 9 8-7 10m7-10 15-5" />}
          {Array.from({ length: [0, 1, 3, 6, 9][level] }, (_, i) => (
            <path
              key={i}
              d="M0-9C-10 4-8 12 0 12S10 4 0-9Z"
              transform={
                "translate(" +
                (27 + (i % 3) * 32) +
                " " +
                (22 + Math.floor(i / 3) * 21) +
                ") scale(.65)"
              }
              fill="#69b4d0"
            />
          ))}
          {level === 4 && (
            <ellipse cx="65" cy="94" rx="24" ry="4" fill="#69b4d0" />
          )}
        </>
      ) : kind === "soil" ? (
        <>
          <path d="M15 29h90v70H15Z" fill="#cda775" />
          <path d="M15 29q22-13 45 0t45 0" stroke="#536a32" />
          {Array.from({ length: (level + 1) * 3 }, (_, i) => (
            <path
              key={i}
              d="M0-4C-5 3-4 6 0 6S5 3 0-4Z"
              transform={
                "translate(" +
                (28 + (i % 4) * 21) +
                " " +
                (47 + Math.floor(i / 4) * 18) +
                ")"
              }
              fill="#357797"
              stroke="none"
            />
          ))}
        </>
      ) : (
        <>
          <path
            d={
              "M8 99 36 " +
              (71 - level * 13) +
              " 62 74 83 " +
              (63 - level * 14) +
              " 113 99Z"
            }
            fill="#a6b695"
          />
          <path d="m26 99 29-33 31 33" fill="#d0d8be" />
        </>
      )}
      {band < 0 && (
        <>
          <circle cx="95" cy="18" r="13" fill="#fff" />
          <path d="M90 18h10" />
        </>
      )}
    </svg>
  );
}
