import { redirect } from 'next/navigation';

export default async function PropertyDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const resolvedParams = await params;
	redirect(`/admin/properties/${resolvedParams.id}/edit`);
}
