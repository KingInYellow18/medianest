import { NextRequest, NextResponse } from "next/server"
import { createPlexPin, getPlexHeaders } from "@/lib/auth/plex-provider"

// Store active PINs in memory (in production, use Redis)
const activePins = new Map<string, { pinId: number; expiresAt: Date }>()

export async function POST(request: NextRequest) {
  try {
    const clientIdentifier = 
      process.env.PLEX_CLIENT_IDENTIFIER || 
      request.headers.get("X-Client-Identifier") ||
      generateClientIdentifier()
    
    const headers = getPlexHeaders(clientIdentifier)
    
    // Create a new PIN with Plex
    const pinResponse = await createPlexPin(clientIdentifier, headers)
    
    // Store PIN info for polling
    const sessionId = generateSessionId()
    activePins.set(sessionId, {
      pinId: pinResponse.id,
      expiresAt: new Date(pinResponse.expiresAt),
    })
    
    // Clean up expired PINs periodically
    cleanupExpiredPins()
    
    return NextResponse.json({
      sessionId,
      pin: pinResponse.code,
      expiresIn: pinResponse.expiresIn,
      authUrl: `https://app.plex.tv/auth#?clientID=${clientIdentifier}&code=${pinResponse.code}&context[device][product]=MediaNest`,
    })
  } catch (error) {
    console.error("Failed to create Plex PIN:", error)
    return NextResponse.json(
      { error: "Failed to create authentication PIN" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get("sessionId")
  
  if (!sessionId || !activePins.has(sessionId)) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 400 }
    )
  }
  
  const pinInfo = activePins.get(sessionId)!
  
  // Check if PIN has expired
  if (new Date() > pinInfo.expiresAt) {
    activePins.delete(sessionId)
    return NextResponse.json(
      { error: "PIN has expired" },
      { status: 400 }
    )
  }
  
  try {
    const clientIdentifier = process.env.PLEX_CLIENT_IDENTIFIER || generateClientIdentifier()
    const headers = getPlexHeaders(clientIdentifier)
    
    // Check PIN status with Plex
    const { checkPlexPin } = await import("@/lib/auth/plex-provider")
    const pinStatus = await checkPlexPin(pinInfo.pinId, clientIdentifier, headers)
    
    if (pinStatus.authToken) {
      // PIN was authorized! Clean up and return success
      activePins.delete(sessionId)
      
      return NextResponse.json({
        authorized: true,
        authToken: pinStatus.authToken,
      })
    }
    
    // Still waiting for authorization
    return NextResponse.json({
      authorized: false,
      expiresIn: Math.floor((pinInfo.expiresAt.getTime() - Date.now()) / 1000),
    })
  } catch (error) {
    console.error("Failed to check Plex PIN:", error)
    return NextResponse.json(
      { error: "Failed to check PIN status" },
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

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function cleanupExpiredPins() {
  const now = new Date()
  for (const [sessionId, pinInfo] of activePins.entries()) {
    if (now > pinInfo.expiresAt) {
      activePins.delete(sessionId)
    }
  }
}