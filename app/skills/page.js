import { redirect } from 'next/navigation';

// Job Match now lives as a tab on the main page instead of its own route.
// This keeps any old bookmarks or shared links working.
export default function SkillsRedirect() {
  redirect('/');
}
