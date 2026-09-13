export default function TermsOfService() {
  return (
    <div className="max-w-2xl mx-auto p-6 text-sm text-gray-700">
      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>
      <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
        <p className="mb-2">
          By using Moneo, you agree to these Terms of Service. If you do not agree to these terms,
          please do not use the service.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">2. Service Description</h2>
        <p className="mb-2">
          Moneo is a focus timer application that helps users track productivity sessions,
          manage focus areas, and optionally sync data across devices.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">3. User Responsibilities</h2>
        <p className="mb-2">
          You agree to:
        </p>
        <ul className="list-disc pl-5 mb-2 space-y-1">
          <li>Use the service for personal productivity purposes only</li>
          <li>Not attempt to reverse engineer or circumvent security measures</li>
          <li>Not use the service for illegal or harmful activities</li>
          <li>Respect the privacy and data of other users</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">4. Data and Content</h2>
        <p className="mb-2">
          You retain ownership of your data. Moneo provides tools to export and delete your data
          upon request. Cloud sync features use Supabase infrastructure, subject to their terms.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">5. Disclaimer of Warranties</h2>
        <p className="mb-2">
          Moneo is provided "as is" without warranties of any kind. We do not guarantee that
          the service will be uninterrupted, secure, or error-free.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">6. Limitation of Liability</h2>
        <p className="mb-2">
          To the maximum extent permitted by law, Moneo shall not be liable for any indirect,
          incidental, special, or consequential damages arising from use of the service.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">7. Termination</h2>
        <p className="mb-2">
          We reserve the right to suspend or terminate your access to the service at any time,
          with or without notice, for any reason.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">8. Changes to Terms</h2>
        <p className="mb-2">
          We may update these terms from time to time. Continued use of the service after changes
          constitutes acceptance of the new terms.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">9. Contact</h2>
        <p className="mb-2">
          For questions about these terms, please contact us at legal@moneo.bond
        </p>
      </section>
    </div>
  );
}
