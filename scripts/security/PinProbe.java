import java.net.URI;
import java.util.Arrays;
import javax.net.ssl.SSLPeerUnverifiedException;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
// Historical diagnostic for the previous pinning policy, not used by the app or release build.
import okhttp3.CertificatePinner;

// JVM smoke test only: the device/proxy cases in the release matrix remain separate.
class PinProbe {
  public static void main(String[] args) throws Exception {
    URI origin = URI.create(args[0]);
    if (!"https".equals(origin.getScheme())) throw new IllegalArgumentException("HTTPS required");
    String host = origin.getHost();
    try (SSLSocket socket = (SSLSocket) SSLSocketFactory.getDefault().createSocket(host, 443)) {
      socket.setSoTimeout(15000);
      var parameters = socket.getSSLParameters();
      parameters.setEndpointIdentificationAlgorithm("HTTPS");
      socket.setSSLParameters(parameters);
      socket.startHandshake();
      var chain = Arrays.asList(socket.getSession().getPeerCertificates());
      var valid = new CertificatePinner.Builder();
      for (int i = 1; i < args.length; i++) valid.add(host, args[i]);
      valid.build().check(host, chain);
      System.out.println("PASS: system TLS validation and configured SPKI accepted");
      try {
        new CertificatePinner.Builder()
          .add(host, "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
          .build().check(host, chain);
        throw new IllegalStateException("Incorrect pin unexpectedly accepted");
      } catch (SSLPeerUnverifiedException expected) {
        if (!expected.getMessage().contains("Certificate pinning failure")) throw expected;
        System.out.println("PASS: incorrect SPKI rejected by OkHttp CertificatePinner");
      }
    }
  }
}
