import { NextRequest, NextResponse } from "next/server"
import { signIn } from "next-auth/react"
import { getPlexHeaders } from "@/lib/auth/plex-provider"

export async function POST(request: NextRequest) {
  try {
    const { authToken } = await request.json()
    
    if (!authToken) {
      return NextResponse.json(
        { error: "No auth token provided" },
        { status: 400 }
      )
    }
    
    // Fetch user info from Plex using the auth token
    const clientIdentifier = process.env.PLEX_CLIENT_IDENTIFIER || generateClientIdentifier()
    const headers = getPlexHeaders(clientIdentifier)
    
    const userResponse = await fetch("https://plex.tv/api/v2/user", {
      headers: {
        ...headers,
        "X-Plex-Token": authToken,
        Accept: "application/json",
      },
    })
    
    if (!userResponse.ok) {
      throw new Error("Failed to fetch Plex user info")
    }
    
    const plexUser = await userResponse.json()
    
    // Store the token temporarily for the NextAuth callback
    // In production, use Redis or another session store
    const tempTokenKey = `plex_token_${plexUser.id}`
    if (typeof window !== "undefined") {
      sessionStorage.setItem(tempTokenKey, authToken)
    }
    
    // Trigger NextAuth sign in with the Plex provider
    // This will use our custom Plex provider to complete the auth flow
    const result = await signIn("plex", {
      redirect: false,
      plexUserId: plexUser.id,
      plexToken: authToken,
    })
    
    if (result?.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      )
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: plexUser.id,
        username: plexUser.username,
        email: plexUser.email,
        thumb: plexUser.thumb,
      },
    })
  } catch (error) {
    console.error("Failed to complete Plex authentication:", error)
    return NextResponse.json(
      { error: "Failed to complete authentication" },
      { status: 500 }
    )
  }
}

function generateClientIdentifier(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}