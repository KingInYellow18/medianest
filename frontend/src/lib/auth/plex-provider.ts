import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth"

export interface PlexProfile {
  id: string
  uuid: string
  username: string
  email: string
  thumb: string
  title: string
  hasPassword: boolean
  authToken: string
  subscription?: {
    active: boolean
    status: string
    plan: string
  }
}

export interface PlexToken {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  authToken: string
}

export interface PlexPinResponse {
  id: number
  code: string
  product: string
  trusted: boolean
  expiresIn: number
  createdAt: string
  expiresAt: string
  authToken?: string
  clientIdentifier: string
}

export default function PlexProvider<P extends PlexProfile>(
  options: OAuthUserConfig<P> & {
    clientIdentifier?: string
    product?: string
    device?: string
    deviceName?: string
    platform?: string
    platformVersion?: string
    version?: string
  }
): OAuthConfig<P> {
  const clientIdentifier = options.clientIdentifier || generateClientIdentifier()
  const product = options.product || "MediaNest"
  const device = options.device || "Web"
  const deviceName = options.deviceName || "MediaNest Web"
  const platform = options.platform || "Web"
  const platformVersion = options.platformVersion || "1.0"
  const version = options.version || "1.0.0"

  return {
    id: "plex",
    name: "Plex",
    type: "oauth",
    version: "2.0",
    authorization: {
      url: "https://app.plex.tv/auth#",
      params: {
        clientID: clientIdentifier,
        context: {
          device: {
            product,
            environment: "bundled",
            layout: "desktop",
            platform,
            platformVersion,
            device,
            deviceName,
            version,
            id: clientIdentifier,
          },
        },
        forwardUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/plex`,
        code: "will-be-generated", // This will be replaced by the PIN
      },
    },
    token: {
      url: "https://plex.tv/api/v2/pins/{pinId}",
      async request({ client, params, checks, provider }) {
        // This is a custom token exchange for Plex PIN auth
        // In practice, we'll need to poll this endpoint until the user authorizes
        throw new Error("Plex PIN auth requires custom implementation")
      },
    },
    userinfo: {
      url: "https://plex.tv/api/v2/user",
      async request({ client, tokens }) {
        const response = await fetch("https://plex.tv/api/v2/user", {
          headers: {
            "X-Plex-Token": tokens.authToken as string,
            "X-Plex-Client-Identifier": clientIdentifier,
            "X-Plex-Product": product,
            "X-Plex-Version": version,
            "X-Plex-Platform": platform,
            "X-Plex-Platform-Version": platformVersion,
            "X-Plex-Device": device,
            "X-Plex-Device-Name": deviceName,
            Accept: "application/json",
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch Plex user info")
        }

        return response.json()
      },
    },
    profile(profile) {
      return {
        id: profile.id,
        name: profile.username,
        email: profile.email,
        image: profile.thumb,
      }
    },
    style: {
      logo: "/plex-logo.svg",
      bg: "#282a2d",
      text: "#fff",
      bgDark: "#1f2022",
      textDark: "#fff",
    },
    options,
  }
}

function generateClientIdentifier(): string {
  // Generate a UUID v4 for the client identifier
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Helper functions for PIN-based authentication flow
export async function createPlexPin(
  clientIdentifier: string,
  headers: Record<string, string>
): Promise<PlexPinResponse> {
  const response = await fetch("https://plex.tv/api/v2/pins", {
    method: "POST",
    headers: {
      ...headers,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      strong: true,
      "X-Plex-Client-Identifier": clientIdentifier,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to create Plex PIN")
  }

  return response.json()
}

export async function checkPlexPin(
  pinId: number,
  clientIdentifier: string,
  headers: Record<string, string>
): Promise<PlexPinResponse> {
  const response = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
    headers: {
      ...headers,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to check Plex PIN status")
  }

  return response.json()
}

export function getPlexHeaders(
  clientIdentifier: string,
  product = "MediaNest",
  version = "1.0.0",
  platform = "Web",
  platformVersion = "1.0",
  device = "Web",
  deviceName = "MediaNest Web"
): Record<string, string> {
  return {
    "X-Plex-Client-Identifier": clientIdentifier,
    "X-Plex-Product": product,
    "X-Plex-Version": version,
    "X-Plex-Platform": platform,
    "X-Plex-Platform-Version": platformVersion,
    "X-Plex-Device": device,
    "X-Plex-Device-Name": deviceName,
  }
}