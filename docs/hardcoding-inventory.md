# Hardcoding Inventory

This inventory registers all platform-specific or site-specific constraints in the codebase that limit generality.

| File | Lines | Description | Impact |
|------|-------|-------------|--------|
| [currentStateResolver.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js) | L13-20 | Checks explicit page types or semantic types like `repository_item` and `/watch` URL patterns. | Restricts video detection to YouTube watch page structure. |
| [currentStateResolver.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js) | L78-89 | Maps platform names (e.g. google, github, youtube) to specific environment categories. | Forces reliance on fixed list of search or media sites. |
| [currentStateResolver.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/world/currentStateResolver.js) | L144-150 | Checks for `/watch`, `/live`, `/shorts` or `video_link` in links. | Hardcodes YouTube-specific link architecture. |
| [goalParser.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/goalParser.js) (legacy) | L126-137 | Uses hardcoded list of platforms (`youtube`, `google`, `github`, etc.). | Fails to detect intent targets outside this list. |
| [capabilities/index.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/index.js) | L24-33 | Hardcodes `SITE_MAP` containing platform-specific homepages. | Limits universal navigation capacity. |
| [eventMatchers.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/planner/eventMatchers.js) | L29-33 | Checks for YouTube-specific `/watch` parameter. | Breaks verification on other media sites. |
| [SearchCapability.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/search/SearchCapability.js) | L75-76 | Fallbacks to legacy purpose checks like `search_launcher` and `search_button`. | Website-driven element categorization. |
| [MediaCapability.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/media/MediaCapability.js) | L41-42 | Hardcoded checks for `video_link` and `/watch`. | Site-dependent media detection. |
| [FormCapability.js](file:///c:/Users/USER/Desktop/Kairos/cloud/src/capabilities/form/FormCapability.js) | L23, L31, L39 | Checks for `login_email`, `login_password`, `login_button` purposes. | Website-specific login structure. |
