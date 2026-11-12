import { cropRecommendations } from "@/lib/tanom/crops";
import { ConditionArt } from "./condition-art";
type Crop = NonNullable<ReturnType<typeof cropRecommendations>>[number];
export function CropCard({ crop, ceb }: { crop: Crop; ceb: boolean }) {
  const t = (en: string, ce: string) => (ceb ? ce : en);
  return (
    <article className="crop-card" data-crop={crop.id}>
      <svg
        className="plant-art"
        viewBox="0 0 120 110"
        fill="none"
        stroke="#456044"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {crop.id === 554 ? (
          <>
            <circle cx="60" cy="58" r="32" fill="#c7d9a1" />
            <path d="M60 89C15 75 27 37 60 58c33-21 45 17 0 31Zm0-31V30M39 37q21 4 21 21 0-17 21-21" />
          </>
        ) : crop.id === 289 ? (
          <>
            <path d="M39 29 60 94 82 29Z" fill="#aecb85" />
            <path d="m49 30 11 64 11-64M38 29h45M60 29V16" />
          </>
        ) : crop.id === 2175 ? (
          <>
            <ellipse cx="60" cy="52" rx="19" ry="33" fill="#edcc70" />
            <path
              d="M41 40h38M41 52h38M43 64h34M53 22v57m14-57v57M60 94Q20 79 25 48q24 9 35 46Q98 77 95 48 72 60 60 94"
              fill="#9db77b"
            />
          </>
        ) : crop.id === 1965 ? (
          <>
            <path
              d="M73 32C97 79 50 108 29 77 16 55 59 61 62 32Z"
              fill="#aa92bb"
            />
            <path d="m58 35 12-14 10 15-12-4Z" fill="#9db77b" />
          </>
        ) : crop.id === 1379 ? (
          <>
            <circle cx="60" cy="63" r="29" fill="#d9957f" />
            <path d="m60 38-18-8 18 1 10-14-2 16 18 1-18 9Z" fill="#9db77b" />
          </>
        ) : crop.id === 1574 ? (
          <>
            <path d="M60 96V26M60 48 36 30M60 60 84 39M60 74 35 56" />
            {[0, 1, 2].map((i) => (
              <g key={i} fill="#edcc70">
                <ellipse cx={34 + i * 8} cy={27 + i * 6} rx="5" ry="9" transform={`rotate(-35 ${34 + i * 8} ${27 + i * 6})`} />
                <ellipse cx={82 - i * 7} cy={36 + i * 6} rx="5" ry="9" transform={`rotate(35 ${82 - i * 7} ${36 + i * 6})`} />
              </g>
            ))}
          </>
        ) : crop.id === 820 ? (
          <>
            <ellipse cx="60" cy="66" rx="35" ry="27" fill="#e4b269" />
            <ellipse cx="60" cy="66" rx="16" ry="27" />
            <path d="M60 39V27q0-10 12-10" />
          </>
        ) : crop.id === 1265 || crop.id === 1420 ? (
          <>
            <path d="M34 91q-17-14 5-38l30-22q27-9 21 16L65 83q-17 22-31 8Z" fill={crop.id === 1265 ? "#bd968c" : "#c8af82"} />
            <path d="m43 65 9 7m4-22 10 7m-10 19 6 4M78 33q-2-17 15-16" />
          </>
        ) : (
          <>
            <path d="M25 79Q48 18 91 28 100 62 25 79Z" fill="#b7ce91" />
            {[43, 60, 77].map((x, i) => (
              <circle key={x} cx={x} cy={61 - i * 10} r="8" fill="#dae6bd" />
            ))}
          </>
        )}
      </svg>
      <h3>{ceb ? crop.ceb : crop.name}</h3>
      {crop.unmet.length > 0 && (
        <p className="crop-alternative">
          {t(
            "Closest alternative — outside tolerances: ",
            "Duol nga kapilian — lapas sa limitasyon: ",
          )}
          {crop.unmet
            .map((v) =>
              ceb
                ? {
                    temperature: "temperatura",
                    rainfall: "ulan",
                    elevation: "kahabogon",
                  }[v]
                : v,
            )
            .join(", ")}
        </p>
      )}
      <div className="crop-tolerances">
        {[
          {
            kind: "heat",
            label: t("Temperature", "Temperatura"),
            range: crop.temp.join("–") + " °C",
            limit: crop.absoluteTemp.join("–") + " °C",
          },
          {
            kind: "water",
            label: t("Annual rain", "Tinuig nga ulan"),
            range: crop.rain.join("–") + " mm",
            limit: crop.absoluteRain.join("–") + " mm",
          },
          {
            kind: "elevation",
            label: t("Elevation", "Kahabogon"),
            range: "≤ " + crop.maxElevation + " m",
            limit: null,
          },
        ].map((row) => (
          <div key={row.kind}>
            <ConditionArt kind={row.kind} band={1} />
            <div>
              <small>{row.label}</small>
              <strong>{row.range}</strong>
              {row.limit && (
                <small>
                  {t("Optimal · limits ", "Labing maayo · limitasyon ")}
                  {row.limit}
                </small>
              )}
            </div>
          </div>
        ))}
      </div>
      <a
        className="crop-info-button"
        href={`https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id=${crop.id}`}
        target="_blank"
        rel="noreferrer"
      >
        {t("View Crop Info", "Tan-awa ang Tanom")}
      </a>
    </article>
  );
}
