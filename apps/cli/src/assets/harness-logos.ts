/**
 * Harness logos as 96×96 PNGs, embedded so the watcher can draw the real
 * mark beside each harness in terminals that support images. Generated from
 * apps/web/public/harnesses/*.svg: each SVG gets a brand-coloured fill (the
 * files carry none) and is rasterised with sharp into a palette PNG on a
 * transparent background. Do not edit by hand; regenerate when the SVGs change.
 */

export const HARNESS_LOGO_SIZE = 96;

const LOGOS: Record<string, string> = {
  "claude-code":
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAC8VBMVEVMaXH/VVXYd1fYdlbZdlf/AADZdlfYd1f/f3/YdlbMZmbY" +
    "d1fff1/Yd1fUdFW/fz/ZdlbYd1fYdlbabUjUcVXZd1fad1bicVXUf1XYeFflf0zZeFbYdlfXeFXfb0/ZdlbZd1bZd1bZd1baeVXZ" +
    "dlbZdlbZd1bZdlbYd1bYdlfXd1fXdVbZdlfZdlfXdU7YdlfadlvZd1bXd1XZd1fZd1bUf1XZdlbZd1bVdVnYc1Xdd1XYdlfYdlbZ" +
    "d1fXd1fZdlXZeFrcc1zZd1bXdVXXdVjZd1fbdVbYdlfad1fYd1jYdlfYdlbdeVjYd1fYclnWeFDYd1bYd1bYdlfZd1fZdVfYd1bZ" +
    "eFfYd1bYeVbYd1fZdFXZd1bYd1fZdljYdlfYd1bZdlbZd1bZdlbYd1XZdlfZdlfYd1bZdlfZeFjaf1vYdlbYd1fYdlbZd1bYd1fY" +
    "dlfYd1bYdlXYeFfYdlbYd1jZdlfadljQc1zZd1fWelvZeFXYdlfXd1XYd1bYdVfZdlfZdlbYd1fZdlbZd1fYdFjYdVbaeFfadVXY" +
    "eFbZd1bZd1bbeFXXd1fZdlfYdlfVc1rYd1fZd1bXdlfZdlfYd1bYdlfZelXYd1fZeFbZd1bad1jZd1fZdlbZdlfZd1fZd1fXdVbY" +
    "d1fZdlbYdlfZdlfYd1fZd1fYdlbZdlbXdlbbeFXYdlbYdlbYd1fZd1fYdVfYd1bYdlbXdVjZdlfZd1badFfZd1bZd1bZd1fZd1ja" +
    "eVXZd1bYeVnZd1bZd1bZd1bZd1bZdlbYdlfYd1fYdlfZd1fZd1fYd1fYd1bdd1XYd1jadVfYdlbZdlXYdlbSeFrXdVjYeFjZdlbY" +
    "dlbYd1bYdlfZdlbWeFfYdlfZd1bZd1badlbYdlbZd1fZd1fZdlbZd1fYdVbZdlbXeFXYeFfYdlfZdlfYd1fYd1fYdlfYd1bYd1fZ" +
    "dlfZdlXadlbZdlfYdlbWeVbbe1fYd1bbdljZd1fYd1bYdlfYd1fYd1XZd1euCtbjAAAA+nRSTlMAA/z3+wHM/gL9BfYI7xgE3/jd" +
    "BxLDTQkGdwpEwTMQgfqi5SqQ2ZaIZMYgW/OqDfUcjS3yywy36yUhD3KKqW9fIhb0JxqAMupaceTxF5oUE4vC25U9kWaEO8cwh89u" +
    "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",
  codex:
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAC6FBMVEVMaXHl5+rm5uvj5+rl5+r////l5enl5+rk5urk5ur////l" +
    "5+vk5url5url5enk5urM///k5ur////k5uvk5+vl5+vk5uvl5erk5urk5+rf39/i4uzl5+rk5uvl5+ri4uLm5urp6enl5eXo6Ojl" +
    "5+zm5uvl5evl5+vl5+rl5url5+rl5eXl5era2trp6enk5+rl6Ov////k5urk5+rk5+rl5+vm5uvk5+rj6Ojk5uvh6+vk5+nk5uvl" +
    "5+rl5uvk5Ovn5+fU1P/k5+vl5urk5+vm5uvk5url5urk5+rk5+rl5+zl5urk5urj5+zl5e7k5uvk5+rm5ubm5uzl5urd7u7l5uri" +
    "6Ojh6enr6+vj5+vk5uvs7Ozk5+vl5ezl5+vk5urk5+vl5+vk6Ozk5url5uvn5+fl5erl5uvk5+vk5uvk5+vj6Ozl5+vl5urk5+rk" +
    "5PHj6urm5u7i6enk5+rk5urk5url5urk5+vk5+rj5unk5uvm5urk5urk5+rk5urm5unl5+vk5+vk5uvk5uvk5+vl5+rl5uvm5uzk" +
    "5Orl5urk5+rk5+rk5uvm5url5uvk5uvf3+/l5+vl5enk6Ovl5urn5+3n5+fl5urk5+vk5+vk5+rm5uzl5uvl5urk5+vk5+rl6Orj" +
    "5+vl5uvk5uvl6Ovl6Ork5Ork5+vi4vDk5+vk5+ri5+zl5+vk5uvn5+3l5+rj5uvl5+rk5uvl5+rl5+vm5uvl5+rk5uvl5+rm5uvl" +
    "5+rl5uvm5unj4+zk5urk5O3g6url5+rk5+nl5+vl5erl6Orl6Ork5+rl5uvk6enk5+vl5evl5uvl5url5uvk5Onj5urk5+vk5uvk" +
    "5+vl6Ozh4fDo6Ojk5+rl5uvl5+vk5urk5url5+vk6Ovk5+rl5+vl5+rl5+vj5uzl5urk6O3l5urj6enl5+nl5evl5uvl5uvl5+rk" +
    "5uvl5ezl5uvk5url5uvk5uzk5uvk5+rl5+vk5urj5+vl5+uuo1rxAAAA93RSTlMA+TNL4wE77/7yAvj9+jz7BfwD9PX38zJ+oggb" +
    "7t2WCT8MChd5XVvO7b3iFGUHGOBPBIfVYoBcVS6cGmHe5OYnIQbCses0e8hM12zGiDce6VcVUvAPuy0jDUKbDplRz9TM2UTxtAtw" +
    "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",
  cursor:
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAB+1BMVEVMaXHHztXIzdXIztbMzNTJzdXJztbJz9X////KytPIzdbI" +
    "zdX////IztbH0tLIzdXMzMzJztbJztXIztbIzdbIzdbExNfIztWqqv/JztXJydTU1NTIztXKztXIzdba2trJzdbHzNTJztXIzdfF" +
    "0NDJzdbJzda/v7/GxuLJzdbJzdbJzdXIztXJztXHzNXK0NbHzdjMzNi/v9/G1NTIzdbJzdbJztXJz9TIztbMzMzJztbIztXK0NXG" +
    "zdTQ0NDIzdbJzdXJzdXJztXIzdXIzdbJztXJztbIztbIztXIyNrKzdfIzdfIztbJzNbJzNbMzN3IztXHztXK0dfJztbJ0NbI0dHP" +
    "z8/IzdXJzdXIzdbJzdXJzdbJzdbIztXIzdXJzdbJztXOztrIzdXIzdXMzNjIzdXJzdTJztbIztbIzdbMzNPJzdXIzdXD0tLFzdXI" +
    "zdXJzdXLz9jI0NjIzdbIzNTKztfJzdXHz9fJzdbIzdbJz9TJzdXIzdXJzda/1NTKytnJztXHzdfIztXJzdfIztXIztbEzdfJztbM" +
    "zNbJzdbIztXJztbIztTGzNbJztXIztbJz9XJztXIztTIztXJztbIz9fIztbHzdPJztbJzdXJzdXIzdXJzdXJzdbIztbIztXJztXI" +
    "ztPIztbJydbKzdXJztbJztbJztbJztb+2lsfAAAAqHRSTlMAb/1eHoCiVQEdkf4C+hf4Bfv84fS7DbMDmRgGiETKB6o89mYWOe0E" +
    "CdrutOzxNywuFAgS1HfMMPUK4PAxJAv53j732M7Sw+fmDk0z3ExRD8tKJ9smHBDA5O/j6fPr6tCsFYLFKIxIeFm2I7pdER/EQzsh" +
    "z0I68iC1llu+n+gMIpRT1zR64hrIGYqyvVQy5agrbipP1kG8KWShaNmBsKmt0S+EE1eewp3vsOtgAAAACXBIWXMAADsOAAA7DgHM" +
    "tqGDAAADUklEQVRo3rWaZ1caQRSGBVxAQBCxxBZRFLvGGLtGUyyxxaiJ0cRoeu+999577+39mYETPVJ2hpnZmefjsrzPOZzlztw7" +
    "m5TEQ8fX9va5jiRV/HSkI4TZ6lYSn2ZqxzxbtUL5+QUrEEGFTXL8RBVieFMnMX5Tfhfi8ObUS4p3WbZAl6CpTEb+61kQubHHcHyK" +
    "FVSyrxqKX6mtRgK6HOuE4+02HxjoD7jE8m/uBCNNRQLxd3LMYMbpP8IZn2c6Ay5atHKe/IFucDNtsbPGN09CiMlmpviG/0VZBJZC" +
    "nmaaggESFvLooiwCtZBPZEMCmXXEouyBFFJ1CzmxKIsQNC2JzS/6BqnMxlSPR+mQjHckqm5OQzptkX/s3PAVzSaLX7/DeSURguTw" +
    "hc/J8rYJ4YUkJVaA4k+tkvLdHl0BsJm9IlL5C4IAWFoqIb/DTBbAac01LPgDigDI0JYby98HugC4bTGSX96WUABcXCYu0MAgCC1O" +
    "JYL5GzOYBEBlY56Q4CkYBcCaDQL5p53sgtDi9IJ7r78UPAKkOtbzCd6BTwBUxy9OFLL6uQXA2lXsgvsQEIS6jLOM+Qc8YgIU52cx" +
    "CR5AUMBYyI9BXMBSyMt6DAkSF/LnMCZIVMgbqg0LgHFKlb0GCQKcJObXeaUIzMSHKRNSBCAJRqBWkFehWLAXagXuGsWCS1AreGxW" +
    "K7D3Qq3gAtQKyn2KBTugVpDSoljgh1rBcadagWsUagUBqBVk9SkW7IZaQadHsaAKagUFYBS4xQRpr2h3RjZ5dp+QwES7sTvqt3yZ" +
    "KiCor6QN7oajH7faJn7Becpto7Vxq5Klj1PwzEu8aUa372I47ogSHCR3jqRDkU4/h+A6cTD7lrIFP9XDKigch1D3XhbYxia4pfsp" +
    "y/zhsMPLINDbyoUmKNuZesVd+xML3ut89JB9BjQwlEAwGL+VG7LxHR7X0AT2o3ztmx73ctLJgkO8Dagug70kQauPt4UmHTW26Qt+" +
    "RF15YmCa26oV6wiSWwTGGMQRn9UZJ5iLHMScMDzGrb0bIyhyCo2SaEfulyMFriaxYRiNK9ri7sT+QXScR2Xs3IKgdL4YVo0pfXHj" +
    "47CCV08CMwvxU40KXj1ZPKcVH2sznDT7g8Ev37m+8g/ld+neL9DWIwAAAABJRU5ErkJggg==",
  opencode:
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAACVBMVEVMaXEjw18ixV6DCk7NAAAAAnRSTlMAM8lDrC4AAAAJcEhZ" +
    "cwAAOw4AADsOAcy2oYMAAABOSURBVGje7dgxEgAQAAPB8P9Ha2hUxtCw94Bsn6RXD5c5AAAAAADeBcpi20AWAwAAAAAAAAAAAAAA" +
    "AAAAAACAX4Drx6xzHAAAAACAsdsAmlEqMQyr1BwAAAAASUVORK5CYII=",
  cline:
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAACQFBMVEVMaXGBjPeBjPeAi/eAi/eAjPeAi/eAjPeEjvSAi/eBjPeA" +
    "jPeAi/d/lP+Di/eBjPiBjPf///+Ai/eJif+BjPiBjPeBi/eBi/eAi/eBi/iAi/iBi/eBjPeCjPeAjPeAjPh/j/9/jPKDiveBjPiH" +
    "h/9/jveAi/eBjPiBi/iBjPh/kf+Ai/iAjPiAjPiFkPOBjPd/jfiAjPeCjPl/i/mAi/eAjPiBjPiAjPmCj/iBjPh/j/eCifiFkfJ/" +
    "f/+Ai/eAi/iAjPeAi/eAi/h/i/eAi/eBi/iAi/iAjPiBi/d/jPiBivaAi/eAjPd/ivmCjfaCjfmAjPeCjPqBi/iAjPiBi/eqqv+A" +
    "i/d/jPiBivaDi/aBi/eAi/eAjPeBi/d/jf+Bi/iBivh/jfd/f/+BjPd/jfqBi/eBjPeAi/iBjPiAjPaAiveBiviAi/eBi/iBi/eZ" +
    "mf+BjPh/jPiAjPeBjPiBi/eDjPaBi/eBjPeAjPeAjPd/i/iBi/eLi/+Bi/eBjfd/iPWEjfV/f/+AjPeAjPiAjPh/f/+BjPiBiviB" +
    "jfaCjPeAjPeAi/iBi/iNjf9/jPiBi/iIiP+BjPiAi/eBjPd/ifWCi/mBi/iAjPh/jfWBjPiAi/iBjPiAi/h/ifmAjPiBjfmBjPeR" +
    "kf+Bi/iAjPiBjPh/i/iCjfaAjfeBi/d/i/iBi/eBifaAjPeCifh/ivmAjPh/iPaBjPiAjPh/jPaAi/iAjPiBi/iGhvGAjPeBjPeB" +
    "i/eCivmBi/iAjPeAi/iBjPiJtHfzAAAAv3RSTlMA9/v++rD89BnQjPKLDCGc/QHSDXaO7/P4lpvx9WKl7BAUI5oRIvbnlHoOuH9v" +
    "F9VK7jEs1H3pWSmeICcVBmPqqWHoQoVNcXuETDuJsi5eLYMz65PLA40mOR+mh21oEpJPJAqGNsnTd6BbZXDW24IFvyjMcmwdgEeu" +
    "j1KzC9dBHBsI8JncAuFRP2Sn5scJUEsPdKz5Gla34DjBeeWdMsZVzwdul7tUXGeqKu092CUw3h7jxDziyMMT2qvZWsW0dcCe5W4A" +
    "AAAJcEhZcwAAOw4AADsOAcy2oYMAAAO9SURBVGje1ZplV1tBEIYTSBMgpQWCuxV3h+JQHAqUtkDxQmmRonV3d3d3d+/8tZ6DNPfu" +
    "bG7uSWbPaefru7wPc9dno9GoD9OPbyMBgd9/DeVrRETBcAjMhWGjK73/l3GQxNel1P75oyCLEGLC2DVg4mUoKWAYUGyj9HctwgDf" +
    "PEJANnAilhAQzAOcJARk8ABRhIAQHgAIx5E3F0C4Yqzj+QcSfqI6HiCZEDDEA6whBET6cgD19jjm3C925vcsN4y7tno2uat275t2" +
    "BhtitLJLlf3KjiywMYybT1n3n5gEO+JgqzX/Rz5gV+g6lP2fuIG9oTh6N9jvD5Bg2f+FDigi25J/1zsSfzD2WgBEAFE85PunuVEB" +
    "4DQXcJ7MH+7ylo23dAkAHOUAYgn9wZ8DGKAEZOFvFOdACYB0BPhA6g8NCBBECygX28cAixFgLS3gKQIspAUs+EcAji1eFRVeLY58" +
    "k+Ruz8Tacb3tAMfg8FktPJiDiE+bFZO6dTYCtJKN40wAI+oHzWJrqU0AhzKpXMZM9BLZMS1ABSCGbTIo16/LxAi5eAl/QLQUPWda" +
    "XLknb7DvsET0SWL+/D3KP5xpkcC2yNQotFiPjiPWpnIkOuneYj2aJOIddPxGw0y3RNagCv0HqNwRJxFfoy4sUk4hzIjGKN6RtGZ1" +
    "j4pLlm6RRK5FsgEDDGbVCYnOittmmI8IgCQFLxABME8Wp0AxgL8prAAxADgwq23yFQWYS2EViAKA14zmIQ7gPKMliwN4zGh+4gAx" +
    "M9orB1EA/VztM1cUYH5Vb7sgBqBfPa/6iQHkahTWCgKAOQHeXOOUFKPM6kUkcibTTcUNB/pQ9VciLkeAaFDeM8uR/oy1SJeIy1hx" +
    "p97Krh+ayupTrIenRPRjxe1WEtBoMtEsP8TUqaTV32YTA9hh9Z5pamZblMgbHJOJVXJxN04A1ebRruMj68l6g3wIbpGKTjcQ4DIa" +
    "Bi6ozYl+s3qVHSVGST/3jqg5XWMAaOcfm0yNWiS6+c2dTwsSU8FGAMD+9s7q6s7jAdy1WFuX2JNS6J+l8objIvqO9v8DiC/ixQhQ" +
    "KbqUQFwMaUSAGlrAY/zYpyMF5OAN6zalfzSn7OhJCXjAKQru1RMCaniF2XY6/wFu5TedLoUUfvE6hso/3kL1/ewbGn/vNksPCP2+" +
    "FP6ORyw/gfRQdMM5pUecBvsLzJnKz1ApqfbZa4OsPaQt+myPf0aa9adA96CPttqH/B5T9zOZwp+22HtMmdQ/9+YV5n4qNaj+8EWT" +
    "wdMTfKc/jkFGI6tyzJAAAAAASUVORK5CYII=",
  copilot:
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAACuFBMVEVMaXGmi/mnivmlh/+qjf+mivm/f/+mivmni/l/f/+jkf+q" +
    "iP+lifunivmmi/myf/+ni/mmi/mljveii/+nivmmivmmivmqqv+qf/+njPiZmf+nh/emivqojfmfj/+mivqmi/qni/mnivqni/ql" +
    "jP+mi/mqifimivmoifn///+ki/amivmqiv+2kf+qjf+mi/qmivqmi/mqiPani/mmi/uni/qoi/mni/qjjv+kjfmni/mnivqmivqm" +
    "i/mmivqnivmhhv+mi/qwif+ni/mnivumivmmivqnivemi/mmivmnivmnivmff/+mi/mnivqmi/mni/mmivqmivini/qni/mmivmn" +
    "i/uoivumi/qmi/qnivqnivmqlP+nifqmivuni/qoi/mljPuoivmmivmqjfeli/qmivmqi/imi/qnivmlifini/mmivqoivmmivqm" +
    "i/qnivqmi/qli/inivqni/mmjPunivqni/mnivqmi/qmivmmi/mmi/qnivmnivqmivqmifqmi/qnifmnivmqhf+ni/mmivmljPqn" +
    "ivqni/mmifWmi/mmivqnivqmi/mmi/mmivqmkP+mi/qnivmnivqmivmnivmni/qnivmljPmmi/mmivqmivqmivmnjPqni/qmi/mn" +
    "ivqnivqnivqkivmni/qnivmnivqnjPaii/+mi/mmivmnjPqoi/qni/qni/ini/umi/qmivqqjfWniPimivmmivqmi/qmivmljPil" +
    "ifqmi/mnivmmifmmi/mmivmoi/mnivqmi/mni/qqi/elivqnivmmi/qljPimi/qmivqni/qnjPumivmnjPqnivmmjPmmivqljPqn" +
    "i/mmi/qmi/qni/mmi/imivmnivimi/uni/qnifqnivmmjPimi/qmjPmmi/mmivmni/qoivqmiPmmi/mni/oAfU2iAAAA53RSTlMA" +
    "9e8RCfgE/u4CDg9K8fsKxuoiC+jtLgMGJgUg2y8Q1d/9ptQUsyf2MgEfZRgHEuGtux5jS6xYzxktj6/i8Jn6E6gNkkbF0COW85G6" +
    "CMSr8vfZUeOAXElEqp/dvQw9SK4sR1W8JGqIKnn0JcCiXqduaXNNsbVFeF19sJC5fJWb3jSlV8MV7IUzzpQaVnZ7woSkF83mqcfr" +
    "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",
};

const decoded = new Map<string, Uint8Array>();

/** PNG bytes of a harness logo, or undefined for harnesses without one. */
export function harnessLogo(id: string): Uint8Array | undefined {
  const b64 = LOGOS[id];
  if (!b64) {
    return;
  }
  let png = decoded.get(id);
  if (!png) {
    png = new Uint8Array(Buffer.from(b64, "base64"));
    decoded.set(id, png);
  }
  return png;
}

/** Ids that have a logo. */
export function harnessLogoIds(): string[] {
  return Object.keys(LOGOS);
}
