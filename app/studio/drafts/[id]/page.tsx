import { MyceliumComposer } from "@/components/composer/mycelium-composer"

export default async function DraftEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MyceliumComposer pieceId={id} />
}
