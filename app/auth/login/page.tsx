import GoogleButton from './GoogleButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div>
      <h1>SHINEN</h1>
      <p>Sign in to save your thoughts</p>
      <GoogleButton next={params.next} />
    </div>
  )
}
