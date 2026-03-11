import { randomInt } from "crypto";

type BuildNfceArgs = {
  company: {
    name?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  companyFiscal: {
    legalName?: string | null;
    tradeName?: string | null;
    ie?: string | null;
    crt?: number | null;
    addressStreet?: string | null;
    addressNumber?: string | null;
    addressDistrict?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressZip?: string | null;
    cityCodeIbge?: string | null;
  } | null;
  order: {
    id: string;
    number?: string | null;
    total?: unknown;
    subtotal?: unknown;
    discount?: unknown;
    confirmedAt?: Date | string | null;
  };
  client: {
    id: string;
    name?: string | null;
    tradeName?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  items: Array<{
    id?: string;
    quantity?: unknown;
    unitPrice?: unknown;
    total?: unknown;
    product?: {
      name?: string | null;
      code?: string | null;
      unit?: { symbol?: string | null } | null;
      fiscal?: {
        origin?: string | null;
        ncm?: { code?: string | null } | null;
        cfop?: { code?: string | null } | null;
        cst?: { code?: string | null } | null;
        csosn?: { code?: string | null } | null;
      } | null;
    } | null;
  }>;
  config: {
    environment?: string | null;
    useTradeNameOnInvoice?: boolean | null;
    useTradeNameOnRecipient?: boolean | null;
  } | null;
  serie?: number | null;
  number?: number | null;
  observation?: string | null;
};

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function n(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function fixed2(value: unknown) {
  return Number(n(value).toFixed(2));
}

function ufToCode(uf: string) {
  const map: Record<string, number> = {
    RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17,
    MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
    MG: 31, ES: 32, RJ: 33, SP: 35,
    PR: 41, SC: 42, RS: 43,
    MS: 50, MT: 51, GO: 52, DF: 53,
  };
  return map[String(uf || "").toUpperCase()] ?? 0;
}

function nowIso(value?: Date | string | null) {
  const d = value ? new Date(value) : new Date();
  return d.toISOString();
}

function tpAmbFromEnvironment(environment?: string | null) {
  return String(environment ?? "").toUpperCase() === "PROD" ? 1 : 2;
}

function buildEmit(args: BuildNfceArgs) {
  const ef = args.companyFiscal;
  if (!ef) throw new Error("Emitente fiscal não configurado.");

  return {
    CNPJ: digits(args.company.document),
    xNome: (args.config?.useTradeNameOnInvoice ? ef.tradeName : null) || ef.legalName || "",
    xFant: ef.tradeName || undefined,
    enderEmit: {
      xLgr: ef.addressStreet || "",
      nro: ef.addressNumber || "S/N",
      xBairro: ef.addressDistrict || "",
      cMun: digits(ef.cityCodeIbge),
      xMun: ef.addressCity || "",
      UF: ef.addressState || "",
      CEP: digits(ef.addressZip),
      cPais: "1058",
      xPais: "BRASIL",
      ...(args.company.phone ? { fone: digits(args.company.phone) } : {}),
    },
    IE: ef.ie || "",
    CRT: Number(ef.crt || 1),
  };
}

function buildDest(client: BuildNfceArgs["client"], useTradeName?: boolean | null) {
  if (!client) {
    return {
      xNome: "CONSUMIDOR FINAL",
    };
  }

  const doc = digits(client.document);
  const isWalkin = String(client.document ?? "").toUpperCase() === "WALKIN";
  const isCnpj = doc.length === 14;
  const isCpf = doc.length === 11;

  return {
    ...(isCnpj ? { CNPJ: doc } : {}),
    ...(isCpf ? { CPF: doc } : {}),
    xNome: (useTradeName ? client.tradeName : null) || client.name || "CONSUMIDOR FINAL",
    ...(client.email ? { email: client.email } : {}),
    ...(isWalkin ? {} : {}),
  };
}

function buildItems(items: BuildNfceArgs["items"]) {
  let totalProdutos = 0;

  const det = items.map((it, idx) => {
    const qty = n(it.quantity);
    const vUnCom = fixed2(it.unitPrice);
    const vProd = fixed2(it.total || qty * vUnCom);
    totalProdutos += vProd;

    const fiscal = it.product?.fiscal;
    const cst = fiscal?.cst?.code || null;
    const csosn = fiscal?.csosn?.code || null;

    return {
      nItem: idx + 1,
      prod: {
        cProd: it.product?.code || String(idx + 1),
        cEAN: "SEM GTIN",
        xProd: it.product?.name || "Produto",
        NCM: fiscal?.ncm?.code || "",
        CFOP: fiscal?.cfop?.code || "",
        uCom: it.product?.unit?.symbol || "UN",
        qCom: qty,
        vUnCom,
        vProd,
        cEANTrib: "SEM GTIN",
        uTrib: it.product?.unit?.symbol || "UN",
        qTrib: qty,
        vUnTrib: vUnCom,
        indTot: 1,
      },
      imposto: {
        ICMS: csosn
          ? {
              ICMSSN102: {
                orig: Number(fiscal?.origin || 0),
                CSOSN: csosn,
              },
            }
          : {
              ICMS00: {
                orig: Number(fiscal?.origin || 0),
                CST: cst || "00",
                modBC: 3,
                vBC: vProd,
                pICMS: 0,
                vICMS: 0,
              },
            },
        PIS: { PISNT: { CST: "07" } },
        COFINS: { COFINSNT: { CST: "07" } },
      },
    };
  });

  return {
    det,
    totals: {
      vProd: fixed2(totalProdutos),
      vNF: fixed2(totalProdutos),
    },
  };
}

export function buildNfcePayload(args: BuildNfceArgs) {
  const emit = buildEmit(args);
  const dest = buildDest(args.client, args.config?.useTradeNameOnRecipient);
  const built = buildItems(args.items);

  const uf = String(args.companyFiscal?.addressState || "").toUpperCase();
  const cUF = ufToCode(uf);
  const dhEmi = nowIso(args.order.confirmedAt);
  const tpAmb = tpAmbFromEnvironment(args.config?.environment);

  const infCpl = [args.observation, args.order.number ? `Pedido: ${args.order.number}` : null]
    .filter(Boolean)
    .join(" | ");

  return {
    infNFe: {
      versao: "4.00",
      ide: {
        cUF,
        cNF: String(randomInt(10000000, 99999999)),
        natOp: "VENDA AO CONSUMIDOR",
        mod: 65,
        serie: Number(args.serie || 1),
        nNF: Number(args.number || 1),
        dhEmi,
        tpNF: 1,
        idDest: 1,
        cMunFG: digits(args.companyFiscal?.cityCodeIbge),
        tpImp: 4,
        tpEmis: 1,
        tpAmb,
        finNFe: 1,
        indFinal: 1,
        indPres: 1,
        procEmi: 0,
        verProc: "ERP Serralheria",
      },
      emit,
      dest,
      det: built.det,
      total: {
        ICMSTot: {
          vBC: built.totals.vProd,
          vICMS: 0,
          vICMSDeson: 0,
          vFCP: 0,
          vBCST: 0,
          vST: 0,
          vFCPST: 0,
          vFCPSTRet: 0,
          vProd: built.totals.vProd,
          vFrete: 0,
          vSeg: 0,
          vDesc: 0,
          vII: 0,
          vIPI: 0,
          vIPIDevol: 0,
          vPIS: 0,
          vCOFINS: 0,
          vOutro: 0,
          vNF: built.totals.vNF,
        },
      },
      transp: {
        modFrete: 9,
      },
      pag: [
        {
          detPag: [
            {
              tPag: "01",
              vPag: built.totals.vNF,
            },
          ],
        },
      ],
      ...(infCpl ? { infAdic: { infCpl } } : {}),
    },
    infNFeSupl: {
      qrCode: "",
      urlChave: "",
    },
  };
}
