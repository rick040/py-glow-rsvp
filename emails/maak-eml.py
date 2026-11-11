"""Bouwt bevestiging-glow.eml uit bevestiging.html en bevestiging.txt.

Outlook opent het .eml-bestand als nieuw concept (X-Unsent: 1). Logo en foto
zitten in de mail zelf, zodat Outlook ze niet blokkeert als externe afbeeldingen.

Gebruik: python3 emails/maak-eml.py
"""
from email import policy
from email.message import EmailMessage
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUBJECT = 'Tot donderdag! Praktische info droneshow GLOW, 12 november'
IMAGES = {
    'https://py-glow-rsvp.vercel.app/assets/parkingyou-logo-wit.png': ('parkingyou-logo@glow-rsvp', 'png'),
    'https://py-glow-rsvp.vercel.app/assets/eindhoven-by-night.jpg': ('eindhoven-by-night@glow-rsvp', 'jpeg'),
}

html = (ROOT / 'emails/bevestiging.html').read_text(encoding='utf-8')
for url, (cid, _) in IMAGES.items():
    assert url in html, url
    html = html.replace(url, f'cid:{cid}')

msg = EmailMessage()
msg['Subject'] = SUBJECT
msg['X-Unsent'] = '1'
msg.set_content((ROOT / 'emails/bevestiging.txt').read_text(encoding='utf-8'))
msg.add_alternative(html, subtype='html')

html_part = msg.get_payload()[1]
for url, (cid, subtype) in IMAGES.items():
    data = (ROOT / 'assets' / url.rsplit('/', 1)[1]).read_bytes()
    html_part.add_related(data, 'image', subtype, cid=f'<{cid}>', disposition='inline')

out = ROOT / 'emails/bevestiging-glow.eml'
out.write_bytes(msg.as_bytes(policy=policy.SMTP))
print(f'{out} ({out.stat().st_size // 1024} KB)')
