export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-6 text-sm text-gray-700">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">1. Data We Collect</h2>
        <p className="mb-2">
          Moneo collects the following data to provide focus tracking and synchronization features:
        </p>
        <ul className="list-disc pl-5 mb-2 space-y-1">
          <li>Focus session data (duration, timestamps, intentions, focus areas)</li>
          <li>Settings and preferences</li>
          <li>Device identifier for sync purposes</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">2. Data Storage</h2>
        <p className="mb-2">
          Your data is stored locally in your browser's localStorage. If you enable cloud sync,
          data is also stored in your Supabase project, which is protected by end-to-end encryption
          and access controls.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">3. Data Sharing</h2>
        <p className="mb-2">
          We do not sell, rent, or share your personal data with third parties for marketing purposes.
          Your data is only used to provide the Moneo service.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">4. Your Rights</h2>
        <p className="mb-2">
          You have the right to:
        </p>
        <ul className="list-disc pl-5 mb-2 space-y-1">
          <li>Access your data at any time</li>
          <li>Delete your account and all associated data</li>
          <li>Export your data</li>
          <li>Disable cloud sync to keep data only locally</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">5. Security</h2>
        <p className="mb-2">
          We use industry-standard encryption and security practices to protect your data.
          However, no method of transmission over the Internet is 100% secure.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">6. Contact</h2>
        <p className="mb-2">
          For questions about this privacy policy or your data, please contact us at
          privacy@moneo.bond
        </p>
      </section>
    </div>
  );
}
