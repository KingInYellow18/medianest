**Project Title:** MediaNest
**Prepared By:** KingInYellow18
**Date:** 6/30/25

**Instructions for You (The Visionary!):**

* **No Tech Jargon Needed!** Just describe your idea in plain English. Think about what you want the program to do and why, not how it does it technically.
* **Be Detailed:** The more information and specific examples you give, the better the AI (our team of virtual coding assistants, called SPARC) can understand and build exactly what you want. Imagine you're describing it to someone who needs to build it perfectly without asking you follow-up questions.
* **Focus on the Goal:** What problem does this solve? What process does it make easier?
* **Don't Worry About Code:** SPARC will figure out the best programming languages, databases, and technical stuff based on your description and its own research.

---

## Section 1: The Big Picture - What is this program all about?

1. **Elevator Pitch:** If you had 30 seconds to describe your program to a friend, what would you say? What's the main goal?
   * Your Answer: MediaNest is a single web portal for everyone I invite to my Plex server. From one login they can request new movies or shows, see which services are running, manage YouTube playlist downloads, browse what's already in Plex and follow guides to other media tools.
2. **Problem Solver:** What specific problem does this program solve, or what task does it make much easier or better?
   * Your Answer: Today friends jump between Overseerr, Uptime Kuma, YouTube download scripts and separate documentation pages. MediaNest puts everything in one place so they can quickly check status, find or request media, and manage playlists without juggling multiple apps.
3. **Why Does This Need to Exist?** What's the key benefit it offers?
   * Your Answer: It saves time and confusion. New users only need one account and one website to handle everything related to my Plex server, from requesting content to reading the user guide.

---

## Section 2: The Users - Who is this program for?

1. **Primary Users:** Describe the main type of person (or people) who will use this program.
   * Your Answer: Friends and family who have access to my Plex server—roughly 10–20 casual users who just want to watch and manage media easily.
2. **User Goals:** When someone uses your program, what are the top things they want to accomplish with it?
   * Your Answer:
     * 1. Request or add a movie or TV show that isn't in Plex.
     * 2. Check that Plex and other services are up and running.
     * 3. Manage and download YouTube playlists into the Plex "YouTube" library.
     * 4. Read the Plex user guide and open links to other services like Audiobookshelf or Calibre-web.

---

## Section 3: The Features - What can the program do?

1. **Core Actions:** List the essential actions or tasks users can perform within the program. Be specific. Use action words.
   * Your Answer:
     * Log in with a single account.
     * View service status via Uptime Kuma integration.
     * Browse existing Plex media.
     * Request missing movies or shows through Overseerr.
     * Manage and download YouTube playlists.
     * Create or update Plex collections in the "YouTube" library.
     * Read a step‑by‑step user guide for new Plex invites.
     * Open quick links to other exposed services (Audiobookshelf, Calibre-web, etc.).
     * Administrators can manage users and configuration settings.
2. **Key Feature Deep Dive:** Pick the MOST important feature from your list above. Describe step-by-step how you imagine someone using that specific feature from start to finish. What do they see? What do they click? What happens next?
   * Your Answer: **Requesting new media through Overseerr** – After logging in, the user opens the "Browse & Request" page. They search for a title. If the movie or show already exists, Plex details appear. If it doesn't, a "Request" button shows up. Clicking it sends the request to Overseerr. The request then shows up in their personal queue with a pending status until it's approved and downloaded.

---

## Section 4: The Information - What does it need to handle?

1. **Information Needed:** What kinds of information does the program need to work with, store, or display?
   * Your Answer:
     * Usernames, emails and hashed passwords.
     * User roles (regular or admin).
     * Media request details: title, type, status, requester, date.
     * Plex library data: titles, availability, collections.
     * Service health data from Uptime Kuma.
     * YouTube playlist entries: original URLs, file names, status.
     * Documentation pages and external service links.
     * System configuration settings.
2. **Data Relationships (Optional but helpful):** Do any pieces of information naturally belong together?
   * Your Answer: Each user can have many media requests and YouTube playlist downloads. Plex library items may belong to collections. Service status applies to the system as a whole, while documentation links and guides are general resources.

---

## Section 5: The Look & Feel - How should it generally seem?

1. **Overall Style:** Choose words that describe the general vibe.
   * Your Answer: Modern & Minimalist with a clean dashboard feel.
2. **Similar Programs (Appearance):** Are there any existing websites or apps whose look you like?
   * Your Answer: Interfaces similar to Overseerr and Plex—simple dashboards with clear navigation.

---

## Section 6: The Platform - Where will it be used?

1. **Primary Environment:** Where do you imagine most people using this program?
   * [x] On a Website (accessed through Chrome, Safari, etc.)
   * [ ] As a Mobile App (on iPhone/iPad)
   * [ ] As a Mobile App (on Android phones/tablets)
   * [ ] As a Computer Program (installed on Windows)
   * [ ] As a Computer Program (installed on Mac)
   * [ ] Other (Please describe):
   * Your Primary Choice & any Secondary Choices: Primarily through a web browser. The site should be responsive so mobile use still feels good.
2. **(If Mobile App):** Does it need to work without an internet connection sometimes? (Yes/No/Not Sure - AI will research implications)
   * Your Answer: No, it relies on the server so an internet connection is required.

---

## Section 7: The Rules & Boundaries - What are the non-negotiables?

1. **Must-Have Rules:** Are there any critical rules the program must follow?
   * Your Answer: Only authenticated users can access features. Admin-only actions like user management or configuration changes must be restricted. Personal data such as passwords must remain private.
2. **Things to Avoid:** Is there anything the program should absolutely not do?
   * Your Answer: It should never expose user emails or passwords publicly, and it shouldn't allow anonymous requests or downloads.

---

## Section 8: Success Criteria - How do we know it's perfect?

1. **Definition of Done:** Describe 2-3 simple scenarios. If the program handles these scenarios exactly as described, you'd consider it a success.
   * Your Scenarios:
     * 1. After signing up and logging in, a user can search for a movie. If it's not in Plex, they can request it through Overseerr and later see the status change when it's added.
     * 2. On the dashboard, users can instantly see whether Plex and other services are up via Uptime Kuma indicators.
     * 3. A user can paste a YouTube playlist link, trigger a download, and later see the playlist appear as a new collection in the Plex "YouTube" library.

---

## Section 9: Inspirations & Comparisons - Learning from others

1. **Similar Programs (Functionality):** Are there any existing programs, websites, or apps that do something similar to what you envision?
   * Your Answer: Plex, Overseerr, Uptime Kuma and various YouTube download managers.
2. **Likes & Dislikes:** For the programs listed above, what do you like or dislike?
   * Likes: Overseerr's smooth search-and-request flow, Plex's clean library views, Uptime Kuma's straightforward status page.
   * Dislikes: Having to jump between all these separate tools with different logins.

---

## Section 10: Future Dreams (Optional) - Where could this go?

1. **Nice-to-Haves:** Are there any features that aren't essential right now but would be great to add later?
   * Your Answer: Push notifications for request updates, deeper analytics about which content gets watched most, and direct integration with torrent downloaders.
2. **Long-Term Vision:** Any thoughts on how this program might evolve in the distant future?
   * Your Answer: It could become a complete media management hub handling automatic downloads, transcoding and cloud backups, making it easy to manage larger libraries.

---

## Section 11: Technical Preferences (Strictly Optional!)

* **Note:** Our AI assistants are experts at choosing the best technical tools. Only fill this out if you have a very strong, specific reason for a particular choice.

1. **Specific Programming Language?** (e.g., Python, JavaScript, Java) Why?
   * Language: None specified.
   * Reason (Mandatory if language specified):
2. **Specific Database?** (e.g., Supabase, PostgreSQL, MySQL) Why?
   * Database: None specified.
   * Reason (Mandatory if database specified):
3. **Specific Cloud Provider?** (e.g., Google Cloud, AWS, Azure) Why?
   * Provider: None specified.
   * Reason (Mandatory if provider specified):

---

**Final Check:**

* Have you answered all the questions in Sections 1-9 as clearly and detailed as possible?
* Have you used simple, everyday language?
* Have you focused on the what and why?
