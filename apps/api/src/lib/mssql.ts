import mssql from "mssql";

import { getApiConfig } from "../plugins/env.js";

/**
 * Conexão com o banco legado SQL Server (dados dos funcionários da empresa).
 * SOMENTE LEITURA — usamos para consultar (por e-mail) e preencher o cadastro
 * do usuário no Postgres. Nunca escrevemos neste banco.
 *
 * Fluxo em 2 passos:
 *   1) Person_Email.char_0 = e-mail  → id_person
 *   2) v_employee (grande JOIN) filtrado por v_enrollment_employee_iud.id_person
 *      → nome, CPF, etc. E Person_Phone (por id_person) → telefone.
 */

/** Dados de um funcionário vindos do banco legado. */
export interface FuncionarioLegado {
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  /** Data de admissão (date_hired) no formato ISO "YYYY-MM-DD". */
  dataAdmissao?: string | null;
  /** Data de nascimento (date_birth) no formato ISO "YYYY-MM-DD". */
  dataNascimento?: string | null;
  /** Sexo binário: 1 = masculino, 0 = feminino (null se desconhecido). */
  sexo?: 0 | 1 | null;
  /** Código do estado civil no catálogo do Postgres (ex.: "CASADO") ou null. */
  estadoCivilCodigo?: string | null;
  /** Cidade (naturalidade). */
  cidade?: string | null;
  /** UF (sigla do estado). */
  uf?: string | null;
  /** PIS (11 dígitos, sem pontuação). */
  pis?: string | null;
  /** Código do banco (3 dígitos FEBRABAN). */
  numeroBanco?: string | null;
  /** Número da conta (sem o dígito). */
  numeroConta?: string | null;
  /** Dígito da conta. */
  digitoConta?: string | null;
  /** Código da entidade no legado (ex.: "164122") — mapeamento p/ FK é passo futuro. */
  entidade?: string | null;
  /** Código do departamento no legado (ex.: "101"). */
  departamento?: string | null;
  funcao?: string | null;
}

/** id_gender do legado → sexo binário (1 = masculino, 0 = feminino). */
function mapearSexo(idGender: number | null): 0 | 1 | null {
  if (idGender === 122) return 1; // Masculino
  if (idGender === 123) return 0; // Feminino
  return null;
}

/** id_marital_status do legado → código do catálogo estados_civis. */
function mapearEstadoCivil(id: number | null): string | null {
  switch (id) {
    case 1:
      return "CASADO";
    case 2:
      return "SOLTEIRO";
    case 3:
      return "DIVORCIADO";
    case 4:
      return "SEPARADO";
    case 6:
      return "VIUVO";
    // 5 = "Maritalmente" (união estável) não existe no catálogo (5 opções) → null.
    default:
      return null;
  }
}

/** Entidades da ACEAM (mesma lista da consulta oficial fornecida pelo RH). */
const ENTITY_CODES = [164111, 164114, 164115, 164122, 164141, 164192];

// Consulta oficial do RH, reduzida às colunas usadas, filtrando pela ponte
// v_enrollment_employee_iud.id_person (essa view já é ligada por id_enrollment).
const QUERY_EMPLOYEE = `
SELECT TOP 1
  v_employee.name_full     AS nome,
  v_employee.code_national AS cpf,
  v_employee.date_hired    AS data_admissao,
  v_employee.date_birth    AS data_nascimento,
  v_employee.id_gender     AS id_gender,
  v_employee.id_marital_status AS id_marital_status,
  ISNULL(v_employee.np_char_3, v_employee.np_char_4) AS pis,
  v_locality.locality_state AS uf,
  v_locality.locality_name AS cidade,
  v_employee.entity_code   AS entity_code,
  v_employee.department_code AS department_code
FROM
  (v_enrollment_employee_iud RIGHT JOIN (((Employee RIGHT JOIN (Country AS Country_1 INNER JOIN (Country RIGHT JOIN (Marital_Status INNER JOIN (((((v_employee_iud INNER JOIN v_employee ON v_employee_iud.id_employee = v_employee.id_employee) INNER JOIN Gender ON v_employee.id_gender = Gender.id_gender) INNER JOIN Status ON v_employee.id_status = Status.id_status) INNER JOIN Employee_Group ON (v_employee.id_employee_group = Employee_Group.id_employee_group) AND (v_employee.id_employee_group = Employee_Group.id_employee_group)) INNER JOIN v_locality ON v_employee.birth_id_locality = v_locality.id_locality) ON Marital_Status.id_marital_status = v_employee.id_marital_status) ON Country.id_country = v_employee.citizenship_id_country) ON Country_1.id_country = v_locality.id_country) ON Employee.id_employee = v_employee.id_employee) INNER JOIN Virtual_Entity_Row ON v_employee_iud.t2_pk_country = Virtual_Entity_Row.id_virtual_entity_row) INNER JOIN Virtual_Entity_Row AS Virtual_Entity_Row_1 ON v_employee_iud.t2_pk_graduation = Virtual_Entity_Row_1.id_virtual_entity_row) ON v_enrollment_employee_iud.id_enrollment = v_employee.id_enrollment) LEFT JOIN Virtual_Entity_Row AS Virtual_Entity_Row_2 ON v_enrollment_employee_iud.t2_pk_termination = Virtual_Entity_Row_2.id_virtual_entity_row
WHERE v_employee.entity_code IN (${ENTITY_CODES.join(",")})
  AND v_enrollment_employee_iud.id_person = @idPerson
`;

let _pool: mssql.ConnectionPool | null = null;

/** Pool de conexão preguiçoso (espelha getDatabase() em database.ts). */
async function getMssql(): Promise<mssql.ConnectionPool> {
  if (_pool) {
    return _pool;
  }

  const { mssql: config } = getApiConfig();

  _pool = await new mssql.ConnectionPool({
    server: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  }).connect();

  return _pool;
}

/** Mantém só dígitos (ex.: "98101-0002" → "981010002"). */
function apenasDigitos(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.replace(/\D/g, "");
  return limpo || null;
}

/** Converte a data do legado para ISO "YYYY-MM-DD" (ou null). */
function paraDataISO(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return data.toISOString().slice(0, 10);
}

/**
 * Separa "conta-dígito" (ex.: "03034691-2") em número (máx. 8 dígitos) e dígito.
 * Sem hífen, trata tudo como conta e o dígito fica null.
 */
function parseConta(account: string | null | undefined): {
  numeroConta: string | null;
  digitoConta: string | null;
} {
  if (!account) return { numeroConta: null, digitoConta: null };
  const [contaRaw, digitoRaw] = account.split("-");
  const numeroConta = (contaRaw ?? "").replace(/\D/g, "").slice(0, 8) || null;
  const digitoConta = digitoRaw
    ? (digitoRaw.replace(/[^0-9xX]/g, "")[0] ?? null)
    : null;
  return { numeroConta, digitoConta };
}

/**
 * Busca um funcionário no banco legado pelo e-mail (apenas consulta).
 * Retorna null se: o legado está desabilitado, o e-mail não existe, ou o
 * funcionário não pertence às entidades da ACEAM.
 */
export async function buscarFuncionarioLegado(
  email: string,
): Promise<FuncionarioLegado | null> {
  const { mssql: config } = getApiConfig();

  if (!config.enabled) {
    return null;
  }

  const pool = await getMssql();

  // Passo 1: e-mail → id_person.
  const emailRes = await pool
    .request()
    .input("email", mssql.VarChar, email)
    .query<{ id_person: number }>(
      `SELECT TOP 1 id_person FROM Person_Email WHERE char_0 = @email`,
    );

  const idPerson = emailRes.recordset[0]?.id_person;
  if (!idPerson) {
    return null;
  }

  // Passo 2: id_person → dados do funcionário.
  const empRes = await pool
    .request()
    .input("idPerson", mssql.Int, idPerson)
    .query<{
      nome: string;
      cpf: string | null;
      data_admissao: Date | string | null;
      data_nascimento: Date | string | null;
      id_gender: number | null;
      id_marital_status: number | null;
      pis: string | null;
      uf: string | null;
      cidade: string | null;
      entity_code: string | null;
      department_code: string | null;
    }>(QUERY_EMPLOYEE);

  const emp = empRes.recordset[0];
  if (!emp) {
    return null;
  }

  // Dados bancários (Person_Bank_Account + v_bank): pega a conta principal
  // (maior percentual → mais recente). account_number = "<conta>-<dígito>".
  const bancoRes = await pool
    .request()
    .input("idPerson", mssql.Int, idPerson)
    .query<{ numero_banco: string | null; account_number: string | null }>(
      `SELECT TOP 1 vb.bank_code AS numero_banco, pba.account_number
       FROM Person_Bank_Account pba
       JOIN v_bank vb ON vb.id_bank = pba.Id_bank
       WHERE pba.id_person = @idPerson
       ORDER BY pba.percentage DESC, pba.id_bank_account DESC`,
    );

  const banco = bancoRes.recordset[0];
  const { numeroConta, digitoConta } = parseConta(banco?.account_number);

  // Telefone (Person_Phone): char_0 = DDD, char_1 = número.
  const telRes = await pool
    .request()
    .input("idPerson", mssql.Int, idPerson)
    .query<{ char_0: string | null; char_1: string | null }>(
      `SELECT TOP 1 char_0, char_1 FROM Person_Phone
       WHERE id_person = @idPerson AND char_1 IS NOT NULL
       ORDER BY id_phone DESC`,
    );

  const tel = telRes.recordset[0];
  const telefoneDigitos = tel
    ? apenasDigitos(`${tel.char_0 ?? ""}${tel.char_1 ?? ""}`)
    : null;
  // O front usa a máscara +55 (DDD) ... — prefixa o país (Brasil) quando o
  // legado traz só DDD + número (≤ 11 dígitos).
  const telefone =
    telefoneDigitos && telefoneDigitos.length <= 11
      ? `55${telefoneDigitos}`
      : telefoneDigitos;

  return {
    nome: emp.nome,
    cpf: apenasDigitos(emp.cpf),
    telefone,
    dataAdmissao: paraDataISO(emp.data_admissao),
    dataNascimento: paraDataISO(emp.data_nascimento),
    sexo: mapearSexo(emp.id_gender),
    estadoCivilCodigo: mapearEstadoCivil(emp.id_marital_status),
    cidade: emp.cidade?.trim() || null,
    uf: emp.uf?.trim() || null,
    pis: apenasDigitos(emp.pis),
    numeroBanco: banco?.numero_banco?.trim() || null,
    numeroConta,
    digitoConta,
    entidade: emp.entity_code ?? null,
    departamento: emp.department_code ?? null,
    funcao: null,
  };
}
