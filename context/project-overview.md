# Potato Trips

## Overview
Potato Trips is an AI-assisted collaborative travel planning application. Users describe the trip they want, answer focused follow-up questions, and receive a structured multi-day itinerary.

The main workspace combines an AI chat panel, a horizontal kanban-style itinerary board, and Google Maps. Users can refine the plan through AI or manual editing, inspect place details, collaborate in real time, and save or export the itinerary.

## Wireframe References
Before implementing a related screen, inspect the wireframes in `context/ui-design/`:
- `Home page.png`
- `My trips.png`
- `Itinerary plan.png`
- `add location.png`
- `location detail.png`

The wireframes define page structure, panel placement, and major interaction flow. They are low-fidelity references. Written requirements take precedence where a wireframe is ambiguous.

## Goals
1. Start trip planning from a natural-language prompt.
2. Let AI collect missing information before generation.
3. Generate a structured itinerary rather than plain text.
4. Present the itinerary as an editable kanban board.
5. Link itinerary places to Google Maps and place details.
6. Support continued AI refinement and manual editing.
7. Support real-time collaboration.
8. Allow preview before sign-in and require sign-in to save.
9. Persist saved trips automatically.
10. Support sharing, export, and usage controls.

## Core User Flow
1. User submits a trip request from the Home page.
2. The app immediately opens the Itinerary Plan workspace.
3. AI asks for missing details such as dates, budget, pace, interests, or travel style.
4. Once enough information is available, AI generates the trip.
5. The app initializes the kanban board and Google Map.
6. User edits the itinerary manually or through AI chat.
7. User may inspect place details or add locations to a selected day.
8. User signs in when they want to save the preview.
9. Saved trips appear in My Trips and can be reopened or collaboratively edited.
10. User may share or export the current itinerary.

## Main Experiences

### Home Page
- Central AI trip input on a spacious landing page.
- Header shows Sign Up and Sign In when logged out.
- Logged-in users see an avatar menu with My Trips, Profile, and Sign Out.

### My Trips
- Displays saved trips in a three-column card grid.
- Selecting a trip opens its Itinerary Plan workspace.

### Itinerary Plan
The main workspace has three persistent areas:
- Left: AI chat.
- Centre: itinerary kanban, Add Location, or Location Detail.
- Right: Google Map.

The map is hidden until the initial itinerary is generated.

### Itinerary Kanban
- Each fixed column represents one trip day.
- Columns are ordered left to right by date and cannot be dragged.
- Items are ordered top to bottom and may move within or across days.
- Clicking a place item opens Location Detail.
- Each day ends with Add Location.

### Add Location and Location Detail
Both replace the centre kanban area rather than opening separate pages.
- Add Location keeps the selected target day, supports suggestions and search, and can add a place to that day.
- Location Detail shows available Google place information and focuses the map on the selected place.
- Closing returns to the previous centre-panel state.

## Core Features
- Authentication and account menu.
- Anonymous preview before sign-in.
- AI clarification, generation, and refinement.
- Kanban drag and drop.
- Google Maps, place search, and place details.
- Automatic cloud persistence.
- Real-time collaboration.
- Shareable itinerary and PDF export.
- Server-side usage tracking and limits.

## Scope

### In Scope
- Responsive web application.
- Home, My Trips, and Itinerary Plan experiences.
- Editable multi-day itinerary kanban.
- Add Location and Location Detail panels.
- Google Maps and place integration.
- Anonymous preview and authenticated saving.
- Automatic persistence and live collaboration.
- Shareable web output and PDF export.
- Basic usage controls for private beta.

### Out of Scope
- Booking or purchasing flights, hotels, transport, or tickets.
- Real-time flight or hotel inventory and pricing.
- Full public-transport navigation.
- Native mobile applications or offline editing.
- Enterprise permission systems.
- Full production billing during private beta.

## Success Criteria
1. AI can collect missing information and generate a structured trip.
2. The kanban board and map initialize from the generated itinerary.
3. Items can be reordered, moved, added, removed, and inspected.
4. AI changes update the same itinerary shown by the board and map.
5. A preview can be saved after sign-in and reopened from My Trips.
6. Saved trips persist automatically and support real-time collaboration.
7. Users can share or export the current itinerary.
8. Cost-sensitive operations can be tracked and limited.