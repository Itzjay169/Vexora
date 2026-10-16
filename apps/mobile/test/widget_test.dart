import 'package:flutter_test/flutter_test.dart';
import 'package:vexora_mobile/main.dart';

void main() {
  testWidgets('VexoraApp smoke test renders brand title', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const VexoraApp());
    // Pump once more so the Riverpod Consumer has fully rebuilt
    await tester.pump();

    // On initial frame the splash screen shows the brand title
    expect(find.text('Vexora Esports Tournament Platform'), findsOneWidget);

    // Drain the deferred session-check timer
    await tester.pump(const Duration(seconds: 1));
  });
}
