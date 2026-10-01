/* ZOD ŠEME NA GRANICI. Svaki odgovor servera prolazi kroz šemu PRE nego što stigne do store-a.

   Namerno su ŠEME OBLIKA, ne čišćenja: stanje (`user_state.data`) je proizvoljan JSON i njegovo čišćenje radi
   `domain/state` (`migrateState` — „odbaci nevažeći zapis", ne „baci grešku"). Zod ovde proverava samo ono što
   klijent mora da zna da bi uopšte nastavio: da je red, da ima `updated_at`, da `data` postoji. */

import { z } from 'zod';

/** Odgovor `POST /auth/v1/token?grant_type=refresh_token`. */
export const RefreshResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional().nullable(),
  expires_in: z.number().optional().nullable()
});
export type RefreshResponse = z.infer<typeof RefreshResponse>;

/** `GET /rest/v1/user_state?select=updated_at,device_id` → niz od 0 ili 1 reda. */
export const RemoteRowList = z.array(
  z.object({ updated_at: z.string().min(1), device_id: z.string().nullable().optional() })
);

/** `GET /rest/v1/user_state?select=data,updated_at`. */
export const PullRowList = z.array(z.object({ data: z.unknown(), updated_at: z.string().min(1) }));

/** Povratak upisa (`return=representation`). */
export const PushResultList = z.array(z.object({ updated_at: z.string().min(1) }));

/** Spisak ranijih verzija — namerno bez `data` (40 verzija je stotine kilobajta). */
export const HistoryList = z.array(
  z.object({
    id: z.union([z.string(), z.number()]),
    napravljeno: z.string(),
    app_version: z.string().nullable().optional(),
    device_id: z.string().nullable().optional()
  })
);
export type HistoryEntry = z.infer<typeof HistoryList>[number];

export const HistoryData = z.array(z.object({ data: z.unknown() }));

/** `GET /auth/v1/user` — samo `user_metadata` nas zanima. */
export const AuthUser = z.object({ user_metadata: z.unknown().optional() }).passthrough();
