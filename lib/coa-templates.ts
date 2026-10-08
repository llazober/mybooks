// Hard-coded starter charts of accounts offered when creating a new entity.
//
// These are pure data (no server/client imports) so both the New-entity modal
// (labels/descriptions) and the addEntity server action (building the ledger
// text) can import them. Account names follow the app's convention: a root
// type (Assets | Liabilities | Equity | Income | COGS | Expenses) followed by
// CamelCase, colon-separated segments — e.g. "Expenses:Office:Supplies".

export interface CoaTemplate {
  id: string;
  label: string;
  description: string;
  accounts: string[];
}

// A fixed, early open date so the accounts always precede any future
// transactions the user enters.
const OPEN_DATE = "2020-01-01";

/** A typical chart for a SERVICE-based business (agency, consulting, trades). */
const SERVICE: CoaTemplate = {
  id: "service",
  label: "Service-based business",
  description: "Consulting, agencies, professional services — no inventory.",
  accounts: [
    // Assets
    "Assets:Bank:Checking",
    "Assets:Bank:Savings",
    "Assets:UndepositedFunds",
    "Assets:AccountsReceivable",
    "Assets:PrepaidExpenses",
    // Liabilities
    "Liabilities:AccountsPayable",
    "Liabilities:CreditCard",
    "Liabilities:SalesTaxPayable",
    "Liabilities:PayrollTaxPayable",
    // Equity
    "Equity:Owner",
    "Equity:OwnerDraws",
    "Equity:RetainedEarnings",
    // Income
    "Income:ServiceRevenue",
    "Income:ConsultingIncome",
    "Income:Interest",
    // COGS (cost of delivering the service)
    "COGS:Subcontractors",
    "COGS:DirectLabor",
    // Expenses
    "Expenses:Advertising",
    "Expenses:BankFees",
    "Expenses:Insurance",
    "Expenses:Meals",
    "Expenses:Office:Supplies",
    "Expenses:Office:Software",
    "Expenses:Payroll",
    "Expenses:PayrollTaxes",
    "Expenses:ProfessionalFees",
    "Expenses:Rent",
    "Expenses:Travel",
    "Expenses:Utilities",
  ],
};

/** A typical chart for a PRODUCT-based business (retail, wholesale, e-commerce). */
const PRODUCT: CoaTemplate = {
  id: "product",
  label: "Product-based business",
  description: "Retail, wholesale, e-commerce — tracks inventory & COGS.",
  accounts: [
    // Assets
    "Assets:Bank:Checking",
    "Assets:Bank:Savings",
    "Assets:UndepositedFunds",
    "Assets:AccountsReceivable",
    "Assets:Inventory",
    "Assets:PrepaidExpenses",
    "Assets:FixedAssets:Equipment",
    "Assets:FixedAssets:AccumulatedDepreciation",
    // Liabilities
    "Liabilities:AccountsPayable",
    "Liabilities:CreditCard",
    "Liabilities:SalesTaxPayable",
    "Liabilities:PayrollTaxPayable",
    "Liabilities:Loan",
    // Equity
    "Equity:Owner",
    "Equity:OwnerDraws",
    "Equity:RetainedEarnings",
    // Income
    "Income:Sales:Products",
    "Income:Sales:Shipping",
    "Income:SalesDiscounts",
    "Income:Interest",
    // COGS
    "COGS:PurchasesResale",
    "COGS:Freight",
    "COGS:Packaging",
    "COGS:MerchantFees",
    // Expenses
    "Expenses:Advertising",
    "Expenses:BankFees",
    "Expenses:Depreciation",
    "Expenses:Insurance",
    "Expenses:Payroll",
    "Expenses:PayrollTaxes",
    "Expenses:Rent",
    "Expenses:Software",
    "Expenses:Supplies",
    "Expenses:Travel",
    "Expenses:Utilities",
  ],
};

/** A typical chart for a NON-PROFIT organization (functional-expense oriented). */
const NONPROFIT: CoaTemplate = {
  id: "nonprofit",
  label: "Non-profit organization",
  description: "Charities & associations — donor-restricted net assets.",
  accounts: [
    // Assets
    "Assets:Bank:Checking",
    "Assets:Bank:Savings",
    "Assets:AccountsReceivable",
    "Assets:PledgesReceivable",
    "Assets:PrepaidExpenses",
    // Liabilities
    "Liabilities:AccountsPayable",
    "Liabilities:CreditCard",
    "Liabilities:PayrollTaxPayable",
    "Liabilities:DeferredRevenue",
    // Equity (net assets)
    "Equity:NetAssets:WithoutDonorRestrictions",
    "Equity:NetAssets:WithDonorRestrictions",
    // Income (support & revenue)
    "Income:Contributions:Individual",
    "Income:Contributions:Corporate",
    "Income:Grants",
    "Income:MembershipDues",
    "Income:ProgramServiceRevenue",
    "Income:FundraisingEvents",
    "Income:Interest",
    // Expenses (by function)
    "Expenses:ProgramServices",
    "Expenses:ManagementAndGeneral",
    "Expenses:Fundraising",
    "Expenses:Salaries",
    "Expenses:PayrollTaxes",
    "Expenses:EmployeeBenefits",
    "Expenses:Rent",
    "Expenses:Utilities",
    "Expenses:Office:Supplies",
    "Expenses:Insurance",
    "Expenses:ProfessionalFees",
    "Expenses:Travel",
    "Expenses:Depreciation",
  ],
};

const VRT: CoaTemplate = {
  id: "vrt-custom",
  label: "VRT Custom Chart of Accounts",
  description: "Generated from Chart of accounts.csv in the VRT Services folder.",
  accounts: [
    "Assets:Current:100-Cash",
    "Assets:Current:100_01-PettyCash",
    "Assets:Current:100_02-CheckingAccount",
    "Assets:Current:100_03-SavingsAccount",
    "Assets:Current:100_99-TotalCashAvailable",
    "Assets:Current:130-AccountsReceivable",
    "Assets:Current:160-Inventory",
    "Assets:Fixed:205-Land",
    "Assets:Fixed:210-Buildings",
    "Assets:Fixed:220-FurnitureFixtures",
    "Assets:Fixed:221-Equipment",
    "Assets:Fixed:240-AutosTrucks",
    "Assets:Fixed:245-LessAccumulatedDepreciation",
    "Assets:Other:255-Goodwill",
    "Assets:Other:260-Deposits",
    "Assets:Other:265-OtherAssets",
    "Liabilities:Current:320-AccountsPayable",
    "Liabilities:Current:330-AccruedExpenses",
    "Liabilities:Current:330_01-FICAEmployerSPart",
    "Liabilities:Current:330_02-WithheldFICA",
    "Liabilities:Current:330_03-WithheldFederalTax",
    "Liabilities:Current:330_04-WithheldStateTax",
    "Liabilities:Current:330_05-StateUnemploymentTax",
    "Liabilities:Current:330_06-FederalUnemploymentTax",
    "Liabilities:Current:330_2-SalesUseTaxPayable",
    "Liabilities:Current:330_3-BackTaxes",
    "Liabilities:Current:340-HealthInsuranceWH",
    "Liabilities:Current:350-NotesPayableCurrentPortion",
    "Liabilities:Current:330_07-WagesPayable",
    "Liabilities:LongTerm:450-NotesPayableLTPortion",
    "Equity:571-PaidInCapital",
    "Equity:572-CapitalStock",
    "Equity:590-RetainedEarnings",
    "Income:601-RetailSalesCategory1",
    "Income:602-RetailSalesCategory2",
    "Income:603-RetailSalesCategory3",
    "Income:621-SalesTaxCollected",
    "Income:630-CommissionsEarned",
    "Income:640-InterestIncome",
    "Income:648-ReturnsAllowances",
    "COGS:656-PurchasesForResale",
    "COGS:680-CommissionsPaidOut",
    "COGS:696-ChangeInInventory",
    "Expenses:710-OfficersSalaries",
    "Expenses:711-SalariesWages",
    "Expenses:712-ContractLabor",
    "Expenses:723-Advertising",
    "Expenses:725-AutoMileageExpense",
    "Expenses:730-BankCharges",
    "Expenses:738-DepreciationExpense",
    "Expenses:744-DuesSubscriptions",
    "Expenses:748-EntertainmentMeals",
    "Expenses:752-Freight",
    "Expenses:758-Insurance",
    "Expenses:762-Interest",
    "Expenses:763-LaundryCleaning",
    "Expenses:765-LegalAccounting",
    "Expenses:766-Licenses",
    "Expenses:770-Miscellaneous",
    "Expenses:772-OverShort",
    "Expenses:774-Postage",
    "Expenses:775-Promotion",
    "Expenses:776-RentsLeases",
    "Expenses:778-RepairsMaintenance",
    "Expenses:782-Supplies",
    "Expenses:786_12-TaxesPayroll",
    "Expenses:786_13-TaxesProperty",
    "Expenses:786_14-TaxesSales",
    "Expenses:786_2-TaxesOther",
    "Expenses:790-Telephone",
    "Expenses:792-Travel",
    "Expenses:795-Utilities",
    "Expenses:500-CostOfGoodsSold",
    "Assets:Current:1000-Cash",
    "Expenses:550-ProfessionalFees",
    "Expenses:534-OfficeSupplies",
    "Expenses:411-SanderTransport",
    "Expenses:481-TransportationService"
  ],
};

/** All starter templates, keyed by id. Order defines menu order. */
export const COA_TEMPLATES: Record<string, CoaTemplate> = {
  "vrt-custom": VRT,
  service: SERVICE,
  product: PRODUCT,
  nonprofit: NONPROFIT,
};

/** Templates as an ordered list (handy for rendering menus). */
export const COA_TEMPLATE_LIST: CoaTemplate[] = [VRT, SERVICE, PRODUCT, NONPROFIT];

/**
 * Build the Beancount `open` directives for a template id, e.g.
 *   2020-01-01 open Assets:Bank:Checking USD
 * Returns "" for an unknown id (caller treats that as "empty ledger").
 */
export function templateOpenDirectives(
  id: string,
  currency = "USD"
): string {
  const t = COA_TEMPLATES[id];
  if (!t) return "";
  return (
    t.accounts
      .map((account) => `${OPEN_DATE} open ${account} ${currency}`)
      .join("\n") + "\n"
  );
}
