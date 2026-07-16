import { permanentRedirect } from 'next/navigation';

export default function CancellationPolicyRedirectPage() {
  permanentRedirect('/refund-policy');
}
