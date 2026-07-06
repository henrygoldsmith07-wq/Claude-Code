import { z } from "zod";

const WeatherApiResponseSchema = z.object({
  weather: z.array(z.object({
    description: z.string(),
    icon: z.string(),
  })),
  main: z.object({
    temp: z.number(),
    feels_like: z.number(),
  }),
  name: z.string(),
});

export type WeatherApiResponse = z.infer<typeof WeatherApiResponseSchema>;

export async function getWeather(): Promise<WeatherApiResponse> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENWEATHER_API_KEY is not set");
  }

  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=Llanishen,Cardiff,GB&appid=${apiKey}&units=metric`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch weather data: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return WeatherApiResponseSchema.parse(data);
}
