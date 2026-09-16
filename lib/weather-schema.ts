import { z } from "zod";
const nonnegative = z.number().finite().min(0).nullable();
const percent = z.number().finite().min(0).max(100).nullable();
export const weatherSchema = z.object({
  hourly: z
    .object({
      time: z.array(z.number().int().positive()).min(49),
      precipitation: z.array(nonnegative),
      rain: z.array(nonnegative),
      precipitation_probability: z.array(percent),
      relative_humidity_2m: z.array(percent),
      surface_pressure: z.array(nonnegative),
      cloud_cover: z.array(percent),
      wind_speed_10m: z.array(nonnegative),
      cape: z.array(nonnegative),
      soil_moisture_0_to_1cm: z.array(
        z.number().finite().min(0).max(1).nullable(),
      ),
      temperature_2m: z.array(z.number().finite().nullable()),
    })
    .superRefine((hourly, ctx) => {
      for (const [key, values] of Object.entries(hourly)) {
        if (values.length !== hourly.time.length)
          ctx.addIssue({ code: "custom", message: `Misaligned ${key} series` });
      }
      if (hourly.time.some((t, i) => i > 0 && t - hourly.time[i - 1] !== 3600))
        ctx.addIssue({
          code: "custom",
          message: "Hourly timestamps must be continuous",
        });
    }),
});
export type WeatherResponse = z.infer<typeof weatherSchema>;
