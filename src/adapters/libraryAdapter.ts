export interface BranchHolding {
  /** library_branches.opac_branch_code と一致させる値(例: "本館", "学くすのき") */
  branchCode: string;
  /** 図書館システムが返す生の貸出状況文字列(例: "貸出中", "貸出可")。取得できない場合はnull */
  status: string | null;
  reserveUrl: string | null;
}

export interface LibraryAdapter {
  /** 指定ISBNの蔵書を検索する。この図書館システムに蔵書が無い場合は空配列を返す */
  searchByIsbn(isbn: string): Promise<BranchHolding[]>;
}
