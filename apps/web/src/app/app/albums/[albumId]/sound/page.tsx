import { redirect } from "next/navigation";

// "Sound" is the album tab over Style, References and Demos, and the tab itself opens Style;
// a typed or remembered /sound address goes to the same place instead of a not-found page.
export default async function AlbumSoundPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  redirect(`/app/albums/${encodeURIComponent(albumId)}/style`);
}
