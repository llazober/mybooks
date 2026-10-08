"use client";

import { useEffect, useState, useTransition } from "react";
import { addTransaction, getAccounts } from "./actions";
import RegisterView from "./RegisterView";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DataEntryView({
  entityId,
  onChange,
  focus,
  onFocusConsumed,
}: {
  entityId: string;
  onChange?: () => void;
  focus?: { account: string; txId: string } | null;
  onFocusConsumed?: () => void;
}) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [registerVersion, setRegisterVersion] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [date, setDate] = useState(todayISO());
  const [payee, setPayee] = useState("");
  const [narration, setNarration] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [amount, setAmount] = useState("");

  function refresh() {
    startTransition(async () => {
      const accs = await getAccounts(entityId);
      setAccounts(accs);
      setDebit((d) => d || accs.find((a) => a.startsWith("Expenses")) || accs[0] || "");
      setCredit((c) => c || accs.find((a) => a.startsWith("Assets")) || accs[0] || "");
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  function submit() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await addTransaction(entityId, {
        date,
        payee,
        narration,
        debitAccount: debit,
        creditAccount: credit,
        amount,
      });
      if (!res.ok) {
        setError(res.error || "Could not save");
        return;
      }
      setOkMsg("Transaction added.");
      setPayee("");
      setNarration("");
      setAmount("");
      setRegisterVersion((v) => v + 1);
      onChange?.();
    });
  }

  return (
    <div className="grid">

      <RegisterView
        key={entityId + ":" + registerVersion}
        entityId={entityId}
        accountsHint={accounts}
        focus={focus}
        onFocusConsumed={onFocusConsumed}
        onChange={() => {
          // RegisterView refreshes its own rows after edits; don't bump
          // registerVersion here or it would remount and lose the current
          // single-line / edit / account-filter state. Only the top "Basic
          // data entry" form (submit) remounts, to surface its new row.
          onChange?.();
        }}
      />
    </div>
  );
}
