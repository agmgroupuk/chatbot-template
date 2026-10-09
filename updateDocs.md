# Update
Update Documentation
--------------------

Welcome to the reference documentation for the [Update](https://update.dev/) Javascript client. This documentation is intended for developers who want to use the Update Javascript client to build their own applications.

For support, join the [Update Discord server](https://discord.gg/Guege5tXFK) or [open a GitHub issue](https://github.com/updatedotdev/js/issues).

* * *

What is Update?
---------------

[Update](https://update.dev/) lets you add SaaS subscriptions to your app in under 5 minutes. No backend routes. No webhook handling. No complex integrations. Just a few lines of code to turn your app into a fully monetized SaaS business.

Whether you're using [Supabase](https://supabase.com/), [Firebase](https://firebase.google.com/), [Clerk](https://clerk.com/), or your own custom auth — and whether you're monetizing with subscriptions, one-time payments, or usage-based plans — Update helps you launch your SaaS faster than ever before.

* * *

Wrap auth + billing, your way
-----------------------------

Stop spending weeks building subscription logic. Update acts as a unified layer over your auth and billing providers, handling all the complex integration work for you. Install our SDK, add a few lines of code, and you're ready to accept payments.

Just pass us a session token from your auth provider, and we'll do the rest — mapping users to subscriptions, checking entitlements, and handling checkout flows. Launch your SaaS in minutes, not weeks.

* * *

Use your stack, not ours
------------------------

Update is provider-agnostic — we support [Supabase](https://supabase.com/), [Clerk](https://clerk.com/), [Firebase](https://firebase.google.com/), and custom JWT-based auth out of the box. And for billing, we integrate directly with [Stripe](https://stripe.com/), with more providers like [Paddle](https://paddle.com/) and [LemonSqueezy](https://lemonsqueezy.com/) coming soon.

Whether you're building with [React](https://react.dev/), [Next.js](https://nextjs.org/), [SvelteKit](https://kit.svelte.dev/), or something else, you can plug Update in with minimal setup and start monetizing in minutes.

* * *

Handle everything from the client
---------------------------------

Because you pass the session token from your auth provider, Update can run entirely on the client. No need to build a complex backend or manage infrastructure — you can implement subscriptions, handle payments, and check user entitlements all from your frontend code. Go from zero to paid subscriptions in 5 minutes or less.

* * *

Installation
------------

```
npm install @updatedev/js
```

```
yarn add @updatedev/js
```

```
pnpm add @updatedev/js
```


* * *

Quickstart
----------

An easy way to get started with Update is to use the `create-update-app` command. From this tool, you can choose a framework and have a fully working Update application in seconds. All you need to do is provide a name and your API keys.

```
npm create update@latest
```
```
yarn create update
```
```
pnpm create update@latest
```
```
bun create update@latest
```

See our [examples](https://github.com/updatedotdev/examples) for source code and examples of how to use Update in different frameworks.

* * *

Initializing
------------

### Create Update Client

To use Update throughout your application, you'll need to initialize the main client first.

Depending on what auth provider you are using, you can initialize the client with different options.


Client Side:

```

import { createClient } from "@updatedev/js";
export async function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      // This must be replaced with your own logic to get your session token
      // For example, with Supabase:
      // 
      // import { createSupabaseClient } from '@/utils/supabase/client'
      // const supabase = createSupabaseClient()
      // const { data } = await supabase.auth.getSession()
      // if (data.session == null) return
      // return data.session.access_token
      // For this example, we'll just return a static token
      return "your-session-token";
    },
    environment: process.env.NODE_ENV === "production" ? "live" : "test",
  });
}
```


Server Side:
```
import { createClient } from "@updatedev/js";

export async function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      // This must be replaced with your own logic to get your session token
      // For example, with Supabase:
      // 
      // import { createSupabaseClient } from '@/utils/supabase/server'
      // const supabase = await createSupabaseClient()
      // const { data } = await supabase.auth.getSession()
      // if (data.session == null) return
      // return data.session.access_token

      // For this example, we'll just return a static token
      return "your-session-token";
    },
    environment: process.env.NODE_ENV === "production" ? "live" : "test",
  });
}
```


Environment Variables:

```
NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY=...
UPDATE_SECRET_KEY=... # Server-side only!
```


* * *

Next.js
-------

### Using Update in a SSR environment

For the full Next.js example with source code, see our [Next.js example](https://github.com/updatedotdev/examples/tree/main/next-supabase).

You should create a `utils/update` directory where you can create `client` and `server` files.

```

npm install @updatedev/js
```



Client:
```

import { createClient } from "@updatedev/js";
export async function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      // This must be replaced with your own logic to get your session token
      // For example, with Supabase:
      // 
      // import { createSupabaseClient } from '@/utils/supabase/client'
      // const supabase = createSupabaseClient()
      // const { data } = await supabase.auth.getSession()
      // if (data.session == null) return
      // return data.session.access_token
      // For this example, we'll just return a static token
      return "your-session-token";
    },
    environment: process.env.NODE_ENV === "production" ? "live" : "test",
  });
}
```


Server:
```
import { createClient } from "@updatedev/js";

export async function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      // This must be replaced with your own logic to get your session token
      // For example, with Supabase:
      // 
      // import { createSupabaseClient } from '@/utils/supabase/server'
      // const supabase = await createSupabaseClient()
      // const { data } = await supabase.auth.getSession()
      // if (data.session == null) return
      // return data.session.access_token

      // For this example, we'll just return a static token
      return "your-session-token";
    },
    environment: process.env.NODE_ENV === "production" ? "live" : "test",
  });
}
```


* * *

React
-----

### Using Update in a React environment

For the full React example with source code, see our [React example](https://github.com/updatedotdev/examples/tree/main/react-supabase).

If you're using Update in a React environment, using Update is as easy as installing the package and importing the client.

```
npm install @updatedev/js
```
```
yarn add @updatedev/js
```
```
pnpm add @updatedev/js
```


utils/update.ts
```
import { supabaseClient } from "@/utils/supabase";
import { createClient } from "@updatedev/js";
export const updateClient = createClient(
  import.meta.env.VITE_UPDATE_PUBLISHABLE_KEY!,
  {
    getSessionToken: async () => {
      // This must be replaced with your own logic to get your session token
      // For example, with Supabase:
      //
      // import { supabaseClient } from '@/utils/supabase'
      // ...
      // const { data } = await supabaseClient.auth.getSession()
      // if (data.session == null) return
      // return data.session.access_token
      // For this example, we'll just return a static token
      return "your-session-token";
    },
  }
);
```


* * *

Overview
--------

In order for Update to properly tie billing info to users, we need to be able to identify users. The cool thing about Update is that because you're providing a session token, this can all be done on the client side. If you configure your auth provider and pass the session token to Update, there is no need to create your own backend logic to check user billing info.

You can use Update with ANY auth provider, including if you roll your own auth. For hosted auth providers, we support the following auth providers out of the box:

*   Supabase
*   Clerk
*   Firebase

If your auth provider isn't listed, you can always use the custom auth provider and provide a JWT secret.

* * *

Supabase
--------

### Using Update with Supabase

Before using Update, you'll need to create a Supabase project and enable the auth provider. In the update dashboard, you'll need to add your Supabase project's anon key and project URL.

First, grab your anon key and project URL from the Supabase dashboard:

![Supabase Keys](https://update.dev/_next/image?url=%2Fdocs%2Fauth%2Fsupabase-keys.png&w=1920&q=100)

Then, add the anon key and project URL to the Update dashboard:

![Supabase Auth](https://update.dev/_next/image?url=%2Fdocs%2Fauth%2Fsupabase-config.png&w=1920&q=100)

Then, you can initialize Update with something like the following:


Client-side:
```
import { createClient } from "@updatedev/js";
import { createSupabaseClient } from "@/utils/supabase/client";
export async function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const supabase = createSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data.session == null) return;
      return data.session.access_token;
    },
  });
}
```


Server-side:
```
import { createClient } from "@updatedev/js";
import { createSupabaseClient } from "@/utils/supabase/server";

export async function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const supabase = await createSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data.session == null) return;
      return data.session.access_token;
    },
  });
}
```


* * *

Clerk
-----

### Using Update with Clerk

Get your JWKS URL from the Clerk dashboard:

![Clerk Keys](https://update.dev/_next/image?url=%2Fdocs%2Fauth%2Fclerk-keys.png&w=1920&q=100)

Then, add the JWKS URL to the Update dashboard:

![Clerk Auth](https://update.dev/_next/image?url=%2Fdocs%2Fauth%2Fclerk-config.png&w=1920&q=100)

Then, you can initialize Update with something like the following:



Client-side:
```
import { createClient } from "@updatedev/js";
import { useAuth } from "@clerk/nextjs";
export function useUpdateClient() {
  const { getToken } = useAuth();
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const token = await getToken();
      return token;
    },
  });
}
```


Server-side:
```
import { createClient } from "@updatedev/js";
import { useAuth } from "@clerk/nextjs";

export function useUpdateClient() {
  const { getToken } = useAuth();

  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const token = await getToken();
      return token;
    },
  });
}
```


* * *

Firebase
--------

### Using Update with Firebase

First, grab your Firebase project's api key from the Firebase dashboard:

![Firebase Keys](https://update.dev/_next/image?url=%2Fdocs%2Fauth%2Ffirebase-keys.png&w=1920&q=100)

Then, add the api key to the Update dashboard:

![Firebase Auth](https://update.dev/_next/image?url=%2Fdocs%2Fauth%2Ffirebase-config.png&w=1920&q=100)

Then, you can initialize Update with something like the following:


Client-side:
utils/update/client.ts
```
import { createClient } from "@updatedev/js";
import { firebaseAuth } from "@/utils/firebase/config";
export function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) return null;
      const idToken = await currentUser.getIdToken();
      return idToken;
    },
    environment: process.env.NODE_ENV === "production" ? "live" : "test",
  });
}
```


Server-side:
utils/update/server.ts
```
import { createClient } from "@updatedev/js";
import { getAuthenticatedAppForUser } from "@/utils/firebase/utils";

export async function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const { currentUser } = await getAuthenticatedAppForUser();
      if (!currentUser) return null;
      const idToken = await currentUser.getIdToken();
      return idToken;
    },
    environment: process.env.NODE_ENV === "production" ? "live" : "test",
  });
}

```


* * *

Custom Auth
-----------

### Using Update with Custom Auth

If you're using a custom auth provider, first you'll need to create a JWT secret.

Then, add the JWT secret to the Update dashboard:

![Custom Auth](https://update.dev/_next/image?url=%2Fdocs%2Fauth%2Fcustom-auth-config.png&w=1920&q=100)

Then, you can initialize Update with something like the following:


Client-side:
```
import { createClient } from "@updatedev/js";
import { getSessionToken } from "@/utils/my-custom-auth";
export function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const token = await getSessionToken();
      if (!token) return;
      return token;
    },
  });
}
```


Server-side:
```
import { createClient } from "@updatedev/js";
import { getSessionToken } from "@/utils/my-custom-auth";

export async function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const token = await getSessionToken();
      if (!token) return;
      return token;
    },
  });
}
```


* * *

Get Products
------------

Get all products that you've created in the Update dashboard.

```
const { data, error } = await client.billing.getProducts();
```


Response

```

{
  "data": {
    "products": [
      {
        "id": "f153c19a-b68f-49cd-8327-9fa85442f01c",
        "name": "Basic",
        "description": "",
        "prices": [
          {
            "id": "32b3cce4-d9ce-49a2-a151-f5b85008a6b6",
            "unit_amount": 1000,
            "currency": "usd",
            "interval": "month",
            "interval_count": 1
          }
        ]
      }
    ]
  },
  "error": null
}
```


* * *

Get User Subscriptions
----------------------

Get all subscriptions for a user.

```
const { data: subscriptionData } = await client.billing.getSubscriptions();
```


Response

```

{
  "data": {
    "subscriptions": [
      {
        "id": "3b6da9f5-d0b3-4056-8ab7-621fa5d7af28",
        "status": "active",
        "cancel_at_period_end": false,
        "canceled_at": null,
        "current_period_start": "2025-03-16T14:49:43+00:00",
        "current_period_end": "2025-04-16T14:49:43+00:00",
        "price": {
          "id": "32b3cce4-d9ce-49a2-a151-f5b85008a6b6",
          "unit_amount": 1000,
          "currency": "usd",
          "interval": "month",
          "interval_count": 1
        },
        "product": {
          "id": "f153c19a-b68f-49cd-8327-9fa85442f01c",
          "name": "Basic",
          "description": "",
          "status": "active"
        }
      }
    ]
  },
  "error": null
}
```


* * *

Create Checkout Session
-----------------------

In Update, you can create a checkout session to sell subscriptions and one-time products. We connect with your billing provider to create the session. For now, we only support Stripe.

A typical flow is to get the price id from the `getProducts` function and then redirect the user to the checkout session.


Create Checkout Session:
```
const { data, error } = await client.billing.createCheckoutSession(
  priceId,
  {
    redirect_url: 'http://localhost:3000/protected/subscription',
  },
);
```


Create Checkout Session From Product:
```
const products = await client.billing.getProducts();

...

async function onClick(priceId: string) {
  const { data, error } = await client.billing.createCheckoutSession(priceId);
  window.location.href = data.url;
}

return (
  <div>
    {products.data.map((product) => (
      <button onClick={() => onClick(product.id)}>
        {product.name}
      </button>
    ))}
  </div>
);
```


### Parameters

`price_id`string Required

The price id of the product to create a checkout session for.

`options.redirect_url`string Optional

The URL to redirect the user to after the checkout session is created.

* * *

Cancel Subscription
-------------------

Cancel a subscription.

```
await client.billing.updateSubscription(id, {
  cancel_at_period_end: true,
});
```


* * *

Reactivate Subscription
-----------------------

Reactivate a subscription.

```
await client.billing.updateSubscription(id, {
  cancel_at_period_end: false,
});
```


* * *

List Entitlements
-----------------

List all entitlements for a user.

```
const { data, error } = await client.entitlements.list();
```


Response

```
{
  "data": {
    "entitlements": [
      "premium",
      "pro",
      "enterprise"
    ]
  },
  "error": null
}
```


* * *

Check Entitlement
-----------------

Check if a user has an entitlement.

```
const { data, error } = await client.entitlements.check("premium");
```


Response

```
{
  "data": {
    "has_access": true
  },
  "error": null
}
```
