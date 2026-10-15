# One Fin Software section

The storefront is part of the main Next.js app at `/software/`.

## Layout

- `page.tsx` — storefront entry (imports `src/App.tsx`)
- `account/` — Software billing account UI
- `checkout/` — main-domain Software checkout + completion
- `template-preview/` — HTML template preview route
- `src/` — client storefront UI, catalog data, template HTML assets

Checkout and fulfillment use the main app Stripe client and webhook path.
There is no separate software payment server in this repository.

## Local development

From the repository root:

```sh
npm run dev
npm run build
```
