# Third-party notices

The HackSpain code in this repository is released under the [MIT License](LICENSE), copyright Asociación Exponential Fellowship (HackSpain). This file lists what that license does not cover and the third-party material that ships inside the repository under its own terms. Dependencies installed from npm are not copied here; each package carries its own license.

## Not covered by the MIT License

All rights reserved by their owners. You may run the code with these files in place, but you may not reuse them outside HackSpain without permission.

- **HackSpain name, logos and brand kit**: `apps/web/public/brand-assets/`, `apps/web/public/hs-icon.png`, `apps/web/public/hs-email-logo.png`, `apps/web/public/apple-touch-icon.png`, `apps/web/public/og-landing.png`, `apps/web/src/assets/logo.svg`, `apps/app/public/logo.svg`, and the icons in `apps/app/public/tv-icons/`.
- **Illustrations and artwork**: the Quixote illustrations in `apps/web/src/assets/illustration-*`, `apps/web/src/assets/windmill-*.svg`, `apps/web/public/*quijote*.png`, and `apps/web/public/horse-trot.png`.
- **Video and photos**: the recap video and poster in `apps/web/public/recap/`, the photos of judges and mentors in `apps/web/src/assets/judges/` and `apps/web/src/assets/mentors/`, and the photos in `apps/app/public/arrivals/`, which belong to the people shown.
- **Sponsor and partner logos**: `apps/web/src/assets/sponsors/`, `apps/app/public/sponsors/` and `apps/app/public/tracks/` belong to the companies shown.
- **Third-party tool logos**: the files in `apps/web/public/harnesses/` (Claude, Cline, Cursor, Devin, GitHub Copilot, Google Gemini, Kilo Code, OpenAI, OpenCode, Qwen) are trademarks of their respective owners and appear only to identify those tools.

## Third-party code included in the repository

### Amicro Mono Charts

Chart components adapted in `apps/app/src/app/insights/charts.tsx` and `apps/app/src/app/insights/evolution-charts.tsx` from [Amicro Mono Charts](https://github.com/Subhan-code/Amicro--Micro-transitions-) by Syed Subhan Uddin.

```
MIT License

Copyright (c) 2026 SYED  SUBHAN UDDIN

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fonts bundled in the repository

The landing ships two typefaces in `apps/web/src/assets/fonts/`, both under the SIL Open Font License, Version 1.1. The dashboard loads its fonts from Google Fonts at build time and does not bundle them.

- **DM Sans**: Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)
- **Bungee**: Copyright 2023 The Bungee Project Authors (https://github.com/djrrb/Bungee)

```
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://openfontlicense.org


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
