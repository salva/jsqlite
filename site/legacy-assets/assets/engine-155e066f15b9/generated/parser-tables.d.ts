export declare const tokenIds: {
    readonly SEMI: 1;
    readonly EXPLAIN: 2;
    readonly QUERY: 3;
    readonly PLAN: 4;
    readonly BEGIN: 5;
    readonly TRANSACTION: 6;
    readonly DEFERRED: 7;
    readonly IMMEDIATE: 8;
    readonly EXCLUSIVE: 9;
    readonly COMMIT: 10;
    readonly END: 11;
    readonly ROLLBACK: 12;
    readonly SAVEPOINT: 13;
    readonly RELEASE: 14;
    readonly TO: 15;
    readonly TABLE: 16;
    readonly CREATE: 17;
    readonly IF: 18;
    readonly NOT: 19;
    readonly EXISTS: 20;
    readonly TEMP: 21;
    readonly LP: 22;
    readonly RP: 23;
    readonly AS: 24;
    readonly COMMA: 25;
    readonly WITHOUT: 26;
    readonly ABORT: 27;
    readonly ACTION: 28;
    readonly AFTER: 29;
    readonly ANALYZE: 30;
    readonly ASC: 31;
    readonly ATTACH: 32;
    readonly BEFORE: 33;
    readonly BY: 34;
    readonly CASCADE: 35;
    readonly CAST: 36;
    readonly CONFLICT: 37;
    readonly DATABASE: 38;
    readonly DESC: 39;
    readonly DETACH: 40;
    readonly EACH: 41;
    readonly FAIL: 42;
    readonly OR: 43;
    readonly AND: 44;
    readonly IS: 45;
    readonly ISNOT: 46;
    readonly MATCH: 47;
    readonly LIKE_KW: 48;
    readonly BETWEEN: 49;
    readonly IN: 50;
    readonly ISNULL: 51;
    readonly NOTNULL: 52;
    readonly NE: 53;
    readonly EQ: 54;
    readonly GT: 55;
    readonly LE: 56;
    readonly LT: 57;
    readonly GE: 58;
    readonly ESCAPE: 59;
    readonly ID: 60;
    readonly COLUMNKW: 61;
    readonly DO: 62;
    readonly FOR: 63;
    readonly IGNORE: 64;
    readonly INITIALLY: 65;
    readonly INSTEAD: 66;
    readonly NO: 67;
    readonly KEY: 68;
    readonly OF: 69;
    readonly OFFSET: 70;
    readonly PRAGMA: 71;
    readonly RAISE: 72;
    readonly RECURSIVE: 73;
    readonly REPLACE: 74;
    readonly RESTRICT: 75;
    readonly ROW: 76;
    readonly ROWS: 77;
    readonly TRIGGER: 78;
    readonly VACUUM: 79;
    readonly VIEW: 80;
    readonly VIRTUAL: 81;
    readonly WITH: 82;
    readonly NULLS: 83;
    readonly FIRST: 84;
    readonly LAST: 85;
    readonly CURRENT: 86;
    readonly FOLLOWING: 87;
    readonly PARTITION: 88;
    readonly PRECEDING: 89;
    readonly RANGE: 90;
    readonly UNBOUNDED: 91;
    readonly EXCLUDE: 92;
    readonly GROUPS: 93;
    readonly OTHERS: 94;
    readonly TIES: 95;
    readonly GENERATED: 96;
    readonly ALWAYS: 97;
    readonly MATERIALIZED: 98;
    readonly REINDEX: 99;
    readonly RENAME: 100;
    readonly CTIME_KW: 101;
    readonly ANY: 102;
    readonly BITAND: 103;
    readonly BITOR: 104;
    readonly LSHIFT: 105;
    readonly RSHIFT: 106;
    readonly PLUS: 107;
    readonly MINUS: 108;
    readonly STAR: 109;
    readonly SLASH: 110;
    readonly REM: 111;
    readonly CONCAT: 112;
    readonly PTR: 113;
    readonly COLLATE: 114;
    readonly BITNOT: 115;
    readonly ON: 116;
    readonly INDEXED: 117;
    readonly STRING: 118;
    readonly JOIN_KW: 119;
    readonly CONSTRAINT: 120;
    readonly DEFAULT: 121;
    readonly NULL: 122;
    readonly PRIMARY: 123;
    readonly UNIQUE: 124;
    readonly CHECK: 125;
    readonly REFERENCES: 126;
    readonly AUTOINCR: 127;
    readonly INSERT: 128;
    readonly DELETE: 129;
    readonly UPDATE: 130;
    readonly SET: 131;
    readonly DEFERRABLE: 132;
    readonly FOREIGN: 133;
    readonly DROP: 134;
    readonly UNION: 135;
    readonly ALL: 136;
    readonly EXCEPT: 137;
    readonly INTERSECT: 138;
    readonly SELECT: 139;
    readonly VALUES: 140;
    readonly DISTINCT: 141;
    readonly DOT: 142;
    readonly FROM: 143;
    readonly JOIN: 144;
    readonly USING: 145;
    readonly ORDER: 146;
    readonly GROUP: 147;
    readonly HAVING: 148;
    readonly LIMIT: 149;
    readonly WHERE: 150;
    readonly RETURNING: 151;
    readonly INTO: 152;
    readonly NOTHING: 153;
    readonly FLOAT: 154;
    readonly BLOB: 155;
    readonly INTEGER: 156;
    readonly VARIABLE: 157;
    readonly CASE: 158;
    readonly WHEN: 159;
    readonly THEN: 160;
    readonly ELSE: 161;
    readonly INDEX: 162;
    readonly ALTER: 163;
    readonly ADD: 164;
    readonly WINDOW: 165;
    readonly OVER: 166;
    readonly FILTER: 167;
    readonly COLUMN: 168;
    readonly AGG_FUNCTION: 169;
    readonly AGG_COLUMN: 170;
    readonly TRUEFALSE: 171;
    readonly FUNCTION: 172;
    readonly UPLUS: 173;
    readonly UMINUS: 174;
    readonly TRUTH: 175;
    readonly REGISTER: 176;
    readonly VECTOR: 177;
    readonly SELECT_COLUMN: 178;
    readonly IF_NULL_ROW: 179;
    readonly ASTERISK: 180;
    readonly SPAN: 181;
    readonly ERROR: 182;
    readonly QNUMBER: 183;
    readonly SPACE: 184;
    readonly COMMENT: 185;
    readonly ILLEGAL: 186;
};
export declare const productions: readonly [{
    readonly id: 0;
    readonly signature: "explain ::= EXPLAIN";
}, {
    readonly id: 1;
    readonly signature: "explain ::= EXPLAIN QUERY PLAN";
}, {
    readonly id: 2;
    readonly signature: "cmdx ::= cmd";
}, {
    readonly id: 3;
    readonly signature: "cmd ::= BEGIN transtype trans_opt";
}, {
    readonly id: 4;
    readonly signature: "transtype ::=";
}, {
    readonly id: 5;
    readonly signature: "transtype ::= DEFERRED";
}, {
    readonly id: 6;
    readonly signature: "transtype ::= IMMEDIATE";
}, {
    readonly id: 7;
    readonly signature: "transtype ::= EXCLUSIVE";
}, {
    readonly id: 8;
    readonly signature: "cmd ::= COMMIT|END trans_opt";
}, {
    readonly id: 9;
    readonly signature: "cmd ::= ROLLBACK trans_opt";
}, {
    readonly id: 10;
    readonly signature: "cmd ::= SAVEPOINT nm";
}, {
    readonly id: 11;
    readonly signature: "cmd ::= RELEASE savepoint_opt nm";
}, {
    readonly id: 12;
    readonly signature: "cmd ::= ROLLBACK trans_opt TO savepoint_opt nm";
}, {
    readonly id: 13;
    readonly signature: "create_table ::= createkw temp TABLE ifnotexists nm dbnm";
}, {
    readonly id: 14;
    readonly signature: "createkw ::= CREATE";
}, {
    readonly id: 15;
    readonly signature: "ifnotexists ::=";
}, {
    readonly id: 16;
    readonly signature: "ifnotexists ::= IF NOT EXISTS";
}, {
    readonly id: 17;
    readonly signature: "temp ::= TEMP";
}, {
    readonly id: 18;
    readonly signature: "temp ::=";
}, {
    readonly id: 19;
    readonly signature: "create_table_args ::= LP columnlist conslist_opt RP table_option_set";
}, {
    readonly id: 20;
    readonly signature: "create_table_args ::= AS select";
}, {
    readonly id: 21;
    readonly signature: "table_option_set ::=";
}, {
    readonly id: 22;
    readonly signature: "table_option_set ::= table_option_set COMMA table_option";
}, {
    readonly id: 23;
    readonly signature: "table_option ::= WITHOUT nm";
}, {
    readonly id: 24;
    readonly signature: "table_option ::= nm";
}, {
    readonly id: 25;
    readonly signature: "columnname ::= nm typetoken";
}, {
    readonly id: 26;
    readonly signature: "typetoken ::=";
}, {
    readonly id: 27;
    readonly signature: "typetoken ::= typename LP signed RP";
}, {
    readonly id: 28;
    readonly signature: "typetoken ::= typename LP signed COMMA signed RP";
}, {
    readonly id: 29;
    readonly signature: "typename ::= typename ID|STRING";
}, {
    readonly id: 30;
    readonly signature: "scanpt ::=";
}, {
    readonly id: 31;
    readonly signature: "scantok ::=";
}, {
    readonly id: 32;
    readonly signature: "ccons ::= CONSTRAINT nm";
}, {
    readonly id: 33;
    readonly signature: "ccons ::= DEFAULT scantok term";
}, {
    readonly id: 34;
    readonly signature: "ccons ::= DEFAULT LP expr RP";
}, {
    readonly id: 35;
    readonly signature: "ccons ::= DEFAULT PLUS scantok term";
}, {
    readonly id: 36;
    readonly signature: "ccons ::= DEFAULT MINUS scantok term";
}, {
    readonly id: 37;
    readonly signature: "ccons ::= DEFAULT scantok ID|INDEXED";
}, {
    readonly id: 38;
    readonly signature: "ccons ::= NOT NULL onconf";
}, {
    readonly id: 39;
    readonly signature: "ccons ::= PRIMARY KEY sortorder onconf autoinc";
}, {
    readonly id: 40;
    readonly signature: "ccons ::= UNIQUE onconf";
}, {
    readonly id: 41;
    readonly signature: "ccons ::= CHECK LP expr RP";
}, {
    readonly id: 42;
    readonly signature: "ccons ::= REFERENCES nm eidlist_opt refargs";
}, {
    readonly id: 43;
    readonly signature: "ccons ::= defer_subclause";
}, {
    readonly id: 44;
    readonly signature: "ccons ::= COLLATE ID|STRING";
}, {
    readonly id: 45;
    readonly signature: "generated ::= LP expr RP";
}, {
    readonly id: 46;
    readonly signature: "generated ::= LP expr RP ID";
}, {
    readonly id: 47;
    readonly signature: "autoinc ::=";
}, {
    readonly id: 48;
    readonly signature: "autoinc ::= AUTOINCR";
}, {
    readonly id: 49;
    readonly signature: "refargs ::=";
}, {
    readonly id: 50;
    readonly signature: "refargs ::= refargs refarg";
}, {
    readonly id: 51;
    readonly signature: "refarg ::= MATCH nm";
}, {
    readonly id: 52;
    readonly signature: "refarg ::= ON INSERT refact";
}, {
    readonly id: 53;
    readonly signature: "refarg ::= ON DELETE refact";
}, {
    readonly id: 54;
    readonly signature: "refarg ::= ON UPDATE refact";
}, {
    readonly id: 55;
    readonly signature: "refact ::= SET NULL";
}, {
    readonly id: 56;
    readonly signature: "refact ::= SET DEFAULT";
}, {
    readonly id: 57;
    readonly signature: "refact ::= CASCADE";
}, {
    readonly id: 58;
    readonly signature: "refact ::= RESTRICT";
}, {
    readonly id: 59;
    readonly signature: "refact ::= NO ACTION";
}, {
    readonly id: 60;
    readonly signature: "defer_subclause ::= NOT DEFERRABLE init_deferred_pred_opt";
}, {
    readonly id: 61;
    readonly signature: "defer_subclause ::= DEFERRABLE init_deferred_pred_opt";
}, {
    readonly id: 62;
    readonly signature: "init_deferred_pred_opt ::=";
}, {
    readonly id: 63;
    readonly signature: "init_deferred_pred_opt ::= INITIALLY DEFERRED";
}, {
    readonly id: 64;
    readonly signature: "init_deferred_pred_opt ::= INITIALLY IMMEDIATE";
}, {
    readonly id: 65;
    readonly signature: "conslist_opt ::=";
}, {
    readonly id: 66;
    readonly signature: "tconscomma ::= COMMA";
}, {
    readonly id: 67;
    readonly signature: "tcons ::= CONSTRAINT nm";
}, {
    readonly id: 68;
    readonly signature: "tcons ::= PRIMARY KEY LP sortlist autoinc RP onconf";
}, {
    readonly id: 69;
    readonly signature: "tcons ::= UNIQUE LP sortlist RP onconf";
}, {
    readonly id: 70;
    readonly signature: "tcons ::= CHECK LP expr RP onconf";
}, {
    readonly id: 71;
    readonly signature: "tcons ::= FOREIGN KEY LP eidlist RP REFERENCES nm eidlist_opt refargs defer_subclause_opt";
}, {
    readonly id: 72;
    readonly signature: "defer_subclause_opt ::=";
}, {
    readonly id: 73;
    readonly signature: "onconf ::=";
}, {
    readonly id: 74;
    readonly signature: "onconf ::= ON CONFLICT resolvetype";
}, {
    readonly id: 75;
    readonly signature: "orconf ::=";
}, {
    readonly id: 76;
    readonly signature: "orconf ::= OR resolvetype";
}, {
    readonly id: 77;
    readonly signature: "resolvetype ::= IGNORE";
}, {
    readonly id: 78;
    readonly signature: "resolvetype ::= REPLACE";
}, {
    readonly id: 79;
    readonly signature: "cmd ::= DROP TABLE ifexists fullname";
}, {
    readonly id: 80;
    readonly signature: "ifexists ::= IF EXISTS";
}, {
    readonly id: 81;
    readonly signature: "ifexists ::=";
}, {
    readonly id: 82;
    readonly signature: "cmd ::= createkw temp VIEW ifnotexists nm dbnm eidlist_opt AS select";
}, {
    readonly id: 83;
    readonly signature: "cmd ::= DROP VIEW ifexists fullname";
}, {
    readonly id: 84;
    readonly signature: "cmd ::= select";
}, {
    readonly id: 85;
    readonly signature: "select ::= WITH wqlist selectnowith";
}, {
    readonly id: 86;
    readonly signature: "select ::= WITH RECURSIVE wqlist selectnowith";
}, {
    readonly id: 87;
    readonly signature: "select ::= selectnowith";
}, {
    readonly id: 88;
    readonly signature: "selectnowith ::= selectnowith multiselect_op oneselect";
}, {
    readonly id: 89;
    readonly signature: "multiselect_op ::= UNION";
}, {
    readonly id: 90;
    readonly signature: "multiselect_op ::= UNION ALL";
}, {
    readonly id: 91;
    readonly signature: "multiselect_op ::= EXCEPT|INTERSECT";
}, {
    readonly id: 92;
    readonly signature: "oneselect ::= SELECT distinct selcollist from where_opt groupby_opt having_opt orderby_opt limit_opt";
}, {
    readonly id: 93;
    readonly signature: "oneselect ::= SELECT distinct selcollist from where_opt groupby_opt having_opt window_clause orderby_opt limit_opt";
}, {
    readonly id: 94;
    readonly signature: "values ::= VALUES LP nexprlist RP";
}, {
    readonly id: 95;
    readonly signature: "oneselect ::= mvalues";
}, {
    readonly id: 96;
    readonly signature: "mvalues ::= values COMMA LP nexprlist RP";
}, {
    readonly id: 97;
    readonly signature: "mvalues ::= mvalues COMMA LP nexprlist RP";
}, {
    readonly id: 98;
    readonly signature: "distinct ::= DISTINCT";
}, {
    readonly id: 99;
    readonly signature: "distinct ::= ALL";
}, {
    readonly id: 100;
    readonly signature: "distinct ::=";
}, {
    readonly id: 101;
    readonly signature: "sclp ::=";
}, {
    readonly id: 102;
    readonly signature: "selcollist ::= sclp scanpt expr scanpt as";
}, {
    readonly id: 103;
    readonly signature: "selcollist ::= sclp scanpt STAR";
}, {
    readonly id: 104;
    readonly signature: "selcollist ::= sclp scanpt nm DOT STAR";
}, {
    readonly id: 105;
    readonly signature: "as ::= AS nm";
}, {
    readonly id: 106;
    readonly signature: "as ::=";
}, {
    readonly id: 107;
    readonly signature: "from ::=";
}, {
    readonly id: 108;
    readonly signature: "from ::= FROM seltablist";
}, {
    readonly id: 109;
    readonly signature: "stl_prefix ::= seltablist joinop";
}, {
    readonly id: 110;
    readonly signature: "stl_prefix ::=";
}, {
    readonly id: 111;
    readonly signature: "seltablist ::= stl_prefix nm dbnm as on_using";
}, {
    readonly id: 112;
    readonly signature: "seltablist ::= stl_prefix nm dbnm as indexed_by on_using";
}, {
    readonly id: 113;
    readonly signature: "seltablist ::= stl_prefix nm dbnm LP exprlist RP as on_using";
}, {
    readonly id: 114;
    readonly signature: "seltablist ::= stl_prefix LP select RP as on_using";
}, {
    readonly id: 115;
    readonly signature: "seltablist ::= stl_prefix LP seltablist RP as on_using";
}, {
    readonly id: 116;
    readonly signature: "dbnm ::=";
}, {
    readonly id: 117;
    readonly signature: "dbnm ::= DOT nm";
}, {
    readonly id: 118;
    readonly signature: "fullname ::= nm";
}, {
    readonly id: 119;
    readonly signature: "fullname ::= nm DOT nm";
}, {
    readonly id: 120;
    readonly signature: "xfullname ::= nm";
}, {
    readonly id: 121;
    readonly signature: "xfullname ::= nm DOT nm";
}, {
    readonly id: 122;
    readonly signature: "xfullname ::= nm AS nm";
}, {
    readonly id: 123;
    readonly signature: "xfullname ::= nm DOT nm AS nm";
}, {
    readonly id: 124;
    readonly signature: "joinop ::= COMMA|JOIN";
}, {
    readonly id: 125;
    readonly signature: "joinop ::= JOIN_KW JOIN";
}, {
    readonly id: 126;
    readonly signature: "joinop ::= JOIN_KW nm JOIN";
}, {
    readonly id: 127;
    readonly signature: "joinop ::= JOIN_KW nm nm JOIN";
}, {
    readonly id: 128;
    readonly signature: "on_using ::= ON expr";
}, {
    readonly id: 129;
    readonly signature: "on_using ::= USING LP idlist RP";
}, {
    readonly id: 130;
    readonly signature: "on_using ::=";
}, {
    readonly id: 131;
    readonly signature: "indexed_opt ::=";
}, {
    readonly id: 132;
    readonly signature: "indexed_by ::= INDEXED BY nm";
}, {
    readonly id: 133;
    readonly signature: "indexed_by ::= NOT INDEXED";
}, {
    readonly id: 134;
    readonly signature: "orderby_opt ::=";
}, {
    readonly id: 135;
    readonly signature: "orderby_opt ::= ORDER BY sortlist";
}, {
    readonly id: 136;
    readonly signature: "sortlist ::= sortlist COMMA expr sortorder nulls";
}, {
    readonly id: 137;
    readonly signature: "sortlist ::= expr sortorder nulls";
}, {
    readonly id: 138;
    readonly signature: "sortorder ::= ASC";
}, {
    readonly id: 139;
    readonly signature: "sortorder ::= DESC";
}, {
    readonly id: 140;
    readonly signature: "sortorder ::=";
}, {
    readonly id: 141;
    readonly signature: "nulls ::= NULLS FIRST";
}, {
    readonly id: 142;
    readonly signature: "nulls ::= NULLS LAST";
}, {
    readonly id: 143;
    readonly signature: "nulls ::=";
}, {
    readonly id: 144;
    readonly signature: "groupby_opt ::=";
}, {
    readonly id: 145;
    readonly signature: "groupby_opt ::= GROUP BY nexprlist";
}, {
    readonly id: 146;
    readonly signature: "having_opt ::=";
}, {
    readonly id: 147;
    readonly signature: "having_opt ::= HAVING expr";
}, {
    readonly id: 148;
    readonly signature: "limit_opt ::=";
}, {
    readonly id: 149;
    readonly signature: "limit_opt ::= LIMIT expr";
}, {
    readonly id: 150;
    readonly signature: "limit_opt ::= LIMIT expr OFFSET expr";
}, {
    readonly id: 151;
    readonly signature: "limit_opt ::= LIMIT expr COMMA expr";
}, {
    readonly id: 152;
    readonly signature: "cmd ::= with DELETE FROM xfullname indexed_opt where_opt_ret";
}, {
    readonly id: 153;
    readonly signature: "where_opt ::=";
}, {
    readonly id: 154;
    readonly signature: "where_opt ::= WHERE expr";
}, {
    readonly id: 155;
    readonly signature: "where_opt_ret ::=";
}, {
    readonly id: 156;
    readonly signature: "where_opt_ret ::= WHERE expr";
}, {
    readonly id: 157;
    readonly signature: "where_opt_ret ::= RETURNING selcollist";
}, {
    readonly id: 158;
    readonly signature: "where_opt_ret ::= WHERE expr RETURNING selcollist";
}, {
    readonly id: 159;
    readonly signature: "cmd ::= with UPDATE orconf xfullname indexed_opt SET setlist from where_opt_ret";
}, {
    readonly id: 160;
    readonly signature: "setlist ::= setlist COMMA nm EQ expr";
}, {
    readonly id: 161;
    readonly signature: "setlist ::= setlist COMMA LP idlist RP EQ expr";
}, {
    readonly id: 162;
    readonly signature: "setlist ::= nm EQ expr";
}, {
    readonly id: 163;
    readonly signature: "setlist ::= LP idlist RP EQ expr";
}, {
    readonly id: 164;
    readonly signature: "cmd ::= with insert_cmd INTO xfullname idlist_opt select upsert";
}, {
    readonly id: 165;
    readonly signature: "cmd ::= with insert_cmd INTO xfullname idlist_opt DEFAULT VALUES returning";
}, {
    readonly id: 166;
    readonly signature: "upsert ::=";
}, {
    readonly id: 167;
    readonly signature: "upsert ::= RETURNING selcollist";
}, {
    readonly id: 168;
    readonly signature: "upsert ::= ON CONFLICT LP sortlist RP where_opt DO UPDATE SET setlist where_opt upsert";
}, {
    readonly id: 169;
    readonly signature: "upsert ::= ON CONFLICT LP sortlist RP where_opt DO NOTHING upsert";
}, {
    readonly id: 170;
    readonly signature: "upsert ::= ON CONFLICT DO NOTHING returning";
}, {
    readonly id: 171;
    readonly signature: "upsert ::= ON CONFLICT DO UPDATE SET setlist where_opt returning";
}, {
    readonly id: 172;
    readonly signature: "returning ::= RETURNING selcollist";
}, {
    readonly id: 173;
    readonly signature: "insert_cmd ::= INSERT orconf";
}, {
    readonly id: 174;
    readonly signature: "insert_cmd ::= REPLACE";
}, {
    readonly id: 175;
    readonly signature: "idlist_opt ::=";
}, {
    readonly id: 176;
    readonly signature: "idlist_opt ::= LP idlist RP";
}, {
    readonly id: 177;
    readonly signature: "idlist ::= idlist COMMA nm";
}, {
    readonly id: 178;
    readonly signature: "idlist ::= nm";
}, {
    readonly id: 179;
    readonly signature: "expr ::= LP expr RP";
}, {
    readonly id: 180;
    readonly signature: "expr ::= ID|INDEXED|JOIN_KW";
}, {
    readonly id: 181;
    readonly signature: "expr ::= nm DOT nm";
}, {
    readonly id: 182;
    readonly signature: "expr ::= nm DOT nm DOT nm";
}, {
    readonly id: 183;
    readonly signature: "term ::= NULL|FLOAT|BLOB";
}, {
    readonly id: 184;
    readonly signature: "term ::= STRING";
}, {
    readonly id: 185;
    readonly signature: "term ::= INTEGER";
}, {
    readonly id: 186;
    readonly signature: "expr ::= VARIABLE";
}, {
    readonly id: 187;
    readonly signature: "expr ::= expr COLLATE ID|STRING";
}, {
    readonly id: 188;
    readonly signature: "expr ::= CAST LP expr AS typetoken RP";
}, {
    readonly id: 189;
    readonly signature: "expr ::= ID|INDEXED|JOIN_KW LP distinct exprlist RP";
}, {
    readonly id: 190;
    readonly signature: "expr ::= ID|INDEXED|JOIN_KW LP distinct exprlist ORDER BY sortlist RP";
}, {
    readonly id: 191;
    readonly signature: "expr ::= ID|INDEXED|JOIN_KW LP STAR RP";
}, {
    readonly id: 192;
    readonly signature: "expr ::= ID|INDEXED|JOIN_KW LP distinct exprlist RP filter_over";
}, {
    readonly id: 193;
    readonly signature: "expr ::= ID|INDEXED|JOIN_KW LP distinct exprlist ORDER BY sortlist RP filter_over";
}, {
    readonly id: 194;
    readonly signature: "expr ::= ID|INDEXED|JOIN_KW LP STAR RP filter_over";
}, {
    readonly id: 195;
    readonly signature: "term ::= CTIME_KW";
}, {
    readonly id: 196;
    readonly signature: "expr ::= LP nexprlist COMMA expr RP";
}, {
    readonly id: 197;
    readonly signature: "expr ::= expr AND expr";
}, {
    readonly id: 198;
    readonly signature: "expr ::= expr OR expr";
}, {
    readonly id: 199;
    readonly signature: "expr ::= expr LT|GT|GE|LE expr";
}, {
    readonly id: 200;
    readonly signature: "expr ::= expr EQ|NE expr";
}, {
    readonly id: 201;
    readonly signature: "expr ::= expr BITAND|BITOR|LSHIFT|RSHIFT expr";
}, {
    readonly id: 202;
    readonly signature: "expr ::= expr PLUS|MINUS expr";
}, {
    readonly id: 203;
    readonly signature: "expr ::= expr STAR|SLASH|REM expr";
}, {
    readonly id: 204;
    readonly signature: "expr ::= expr CONCAT expr";
}, {
    readonly id: 205;
    readonly signature: "likeop ::= NOT LIKE_KW|MATCH";
}, {
    readonly id: 206;
    readonly signature: "expr ::= expr likeop expr";
}, {
    readonly id: 207;
    readonly signature: "expr ::= expr likeop expr ESCAPE expr";
}, {
    readonly id: 208;
    readonly signature: "expr ::= expr ISNULL|NOTNULL";
}, {
    readonly id: 209;
    readonly signature: "expr ::= expr NOT NULL";
}, {
    readonly id: 210;
    readonly signature: "expr ::= expr IS expr";
}, {
    readonly id: 211;
    readonly signature: "expr ::= expr IS NOT expr";
}, {
    readonly id: 212;
    readonly signature: "expr ::= expr IS NOT DISTINCT FROM expr";
}, {
    readonly id: 213;
    readonly signature: "expr ::= expr IS DISTINCT FROM expr";
}, {
    readonly id: 214;
    readonly signature: "expr ::= NOT expr";
}, {
    readonly id: 215;
    readonly signature: "expr ::= BITNOT expr";
}, {
    readonly id: 216;
    readonly signature: "expr ::= PLUS|MINUS expr";
}, {
    readonly id: 217;
    readonly signature: "expr ::= expr PTR expr";
}, {
    readonly id: 218;
    readonly signature: "between_op ::= BETWEEN";
}, {
    readonly id: 219;
    readonly signature: "between_op ::= NOT BETWEEN";
}, {
    readonly id: 220;
    readonly signature: "expr ::= expr between_op expr AND expr";
}, {
    readonly id: 221;
    readonly signature: "in_op ::= IN";
}, {
    readonly id: 222;
    readonly signature: "in_op ::= NOT IN";
}, {
    readonly id: 223;
    readonly signature: "expr ::= expr in_op LP exprlist RP";
}, {
    readonly id: 224;
    readonly signature: "expr ::= LP select RP";
}, {
    readonly id: 225;
    readonly signature: "expr ::= expr in_op LP select RP";
}, {
    readonly id: 226;
    readonly signature: "expr ::= expr in_op nm dbnm paren_exprlist";
}, {
    readonly id: 227;
    readonly signature: "expr ::= EXISTS LP select RP";
}, {
    readonly id: 228;
    readonly signature: "expr ::= CASE case_operand case_exprlist case_else END";
}, {
    readonly id: 229;
    readonly signature: "case_exprlist ::= case_exprlist WHEN expr THEN expr";
}, {
    readonly id: 230;
    readonly signature: "case_exprlist ::= WHEN expr THEN expr";
}, {
    readonly id: 231;
    readonly signature: "case_else ::= ELSE expr";
}, {
    readonly id: 232;
    readonly signature: "case_else ::=";
}, {
    readonly id: 233;
    readonly signature: "case_operand ::=";
}, {
    readonly id: 234;
    readonly signature: "exprlist ::=";
}, {
    readonly id: 235;
    readonly signature: "nexprlist ::= nexprlist COMMA expr";
}, {
    readonly id: 236;
    readonly signature: "nexprlist ::= expr";
}, {
    readonly id: 237;
    readonly signature: "paren_exprlist ::=";
}, {
    readonly id: 238;
    readonly signature: "paren_exprlist ::= LP exprlist RP";
}, {
    readonly id: 239;
    readonly signature: "cmd ::= createkw uniqueflag INDEX ifnotexists nm dbnm ON nm LP sortlist RP where_opt";
}, {
    readonly id: 240;
    readonly signature: "uniqueflag ::= UNIQUE";
}, {
    readonly id: 241;
    readonly signature: "uniqueflag ::=";
}, {
    readonly id: 242;
    readonly signature: "eidlist_opt ::=";
}, {
    readonly id: 243;
    readonly signature: "eidlist_opt ::= LP eidlist RP";
}, {
    readonly id: 244;
    readonly signature: "eidlist ::= eidlist COMMA nm collate sortorder";
}, {
    readonly id: 245;
    readonly signature: "eidlist ::= nm collate sortorder";
}, {
    readonly id: 246;
    readonly signature: "collate ::=";
}, {
    readonly id: 247;
    readonly signature: "collate ::= COLLATE ID|STRING";
}, {
    readonly id: 248;
    readonly signature: "cmd ::= DROP INDEX ifexists fullname";
}, {
    readonly id: 249;
    readonly signature: "cmd ::= VACUUM vinto";
}, {
    readonly id: 250;
    readonly signature: "cmd ::= VACUUM nm vinto";
}, {
    readonly id: 251;
    readonly signature: "vinto ::= INTO expr";
}, {
    readonly id: 252;
    readonly signature: "vinto ::=";
}, {
    readonly id: 253;
    readonly signature: "cmd ::= PRAGMA nm dbnm";
}, {
    readonly id: 254;
    readonly signature: "cmd ::= PRAGMA nm dbnm EQ nmnum";
}, {
    readonly id: 255;
    readonly signature: "cmd ::= PRAGMA nm dbnm LP nmnum RP";
}, {
    readonly id: 256;
    readonly signature: "cmd ::= PRAGMA nm dbnm EQ minus_num";
}, {
    readonly id: 257;
    readonly signature: "cmd ::= PRAGMA nm dbnm LP minus_num RP";
}, {
    readonly id: 258;
    readonly signature: "plus_num ::= PLUS INTEGER|FLOAT";
}, {
    readonly id: 259;
    readonly signature: "minus_num ::= MINUS INTEGER|FLOAT";
}, {
    readonly id: 260;
    readonly signature: "cmd ::= createkw trigger_decl BEGIN trigger_cmd_list END";
}, {
    readonly id: 261;
    readonly signature: "trigger_decl ::= temp TRIGGER ifnotexists nm dbnm trigger_time trigger_event ON fullname foreach_clause when_clause";
}, {
    readonly id: 262;
    readonly signature: "trigger_time ::= BEFORE|AFTER";
}, {
    readonly id: 263;
    readonly signature: "trigger_time ::= INSTEAD OF";
}, {
    readonly id: 264;
    readonly signature: "trigger_time ::=";
}, {
    readonly id: 265;
    readonly signature: "trigger_event ::= DELETE|INSERT";
}, {
    readonly id: 266;
    readonly signature: "trigger_event ::= UPDATE";
}, {
    readonly id: 267;
    readonly signature: "trigger_event ::= UPDATE OF idlist";
}, {
    readonly id: 268;
    readonly signature: "when_clause ::=";
}, {
    readonly id: 269;
    readonly signature: "when_clause ::= WHEN expr";
}, {
    readonly id: 270;
    readonly signature: "trigger_cmd_list ::= trigger_cmd_list trigger_cmd SEMI";
}, {
    readonly id: 271;
    readonly signature: "trigger_cmd_list ::= trigger_cmd SEMI";
}, {
    readonly id: 272;
    readonly signature: "tridxby ::= INDEXED BY nm";
}, {
    readonly id: 273;
    readonly signature: "tridxby ::= NOT INDEXED";
}, {
    readonly id: 274;
    readonly signature: "trigger_cmd ::= UPDATE orconf xfullname tridxby SET setlist from where_opt scanpt";
}, {
    readonly id: 275;
    readonly signature: "trigger_cmd ::= scanpt insert_cmd INTO xfullname idlist_opt select upsert scanpt";
}, {
    readonly id: 276;
    readonly signature: "trigger_cmd ::= DELETE FROM xfullname tridxby where_opt scanpt";
}, {
    readonly id: 277;
    readonly signature: "trigger_cmd ::= scanpt select scanpt";
}, {
    readonly id: 278;
    readonly signature: "expr ::= RAISE LP IGNORE RP";
}, {
    readonly id: 279;
    readonly signature: "expr ::= RAISE LP raisetype COMMA expr RP";
}, {
    readonly id: 280;
    readonly signature: "raisetype ::= ROLLBACK";
}, {
    readonly id: 281;
    readonly signature: "raisetype ::= ABORT";
}, {
    readonly id: 282;
    readonly signature: "raisetype ::= FAIL";
}, {
    readonly id: 283;
    readonly signature: "cmd ::= DROP TRIGGER ifexists fullname";
}, {
    readonly id: 284;
    readonly signature: "cmd ::= ATTACH database_kw_opt expr AS expr key_opt";
}, {
    readonly id: 285;
    readonly signature: "cmd ::= DETACH database_kw_opt expr";
}, {
    readonly id: 286;
    readonly signature: "key_opt ::=";
}, {
    readonly id: 287;
    readonly signature: "key_opt ::= KEY expr";
}, {
    readonly id: 288;
    readonly signature: "cmd ::= REINDEX";
}, {
    readonly id: 289;
    readonly signature: "cmd ::= REINDEX nm dbnm";
}, {
    readonly id: 290;
    readonly signature: "cmd ::= ANALYZE";
}, {
    readonly id: 291;
    readonly signature: "cmd ::= ANALYZE nm dbnm";
}, {
    readonly id: 292;
    readonly signature: "cmd ::= ALTER TABLE fullname RENAME TO nm";
}, {
    readonly id: 293;
    readonly signature: "cmd ::= alter_add carglist";
}, {
    readonly id: 294;
    readonly signature: "alter_add ::= ALTER TABLE fullname ADD kwcolumn_opt nm typetoken";
}, {
    readonly id: 295;
    readonly signature: "cmd ::= ALTER TABLE fullname DROP kwcolumn_opt nm";
}, {
    readonly id: 296;
    readonly signature: "cmd ::= ALTER TABLE fullname RENAME kwcolumn_opt nm TO nm";
}, {
    readonly id: 297;
    readonly signature: "cmd ::= ALTER TABLE fullname DROP CONSTRAINT nm";
}, {
    readonly id: 298;
    readonly signature: "cmd ::= ALTER TABLE fullname ALTER kwcolumn_opt nm DROP NOT NULL";
}, {
    readonly id: 299;
    readonly signature: "cmd ::= ALTER TABLE fullname ALTER kwcolumn_opt nm SET NOT NULL onconf";
}, {
    readonly id: 300;
    readonly signature: "cmd ::= ALTER TABLE fullname ADD CONSTRAINT nm CHECK LP expr RP onconf";
}, {
    readonly id: 301;
    readonly signature: "cmd ::= ALTER TABLE fullname ADD CHECK LP expr RP onconf";
}, {
    readonly id: 302;
    readonly signature: "cmd ::= create_vtab";
}, {
    readonly id: 303;
    readonly signature: "cmd ::= create_vtab LP vtabarglist RP";
}, {
    readonly id: 304;
    readonly signature: "create_vtab ::= createkw VIRTUAL TABLE ifnotexists nm dbnm USING nm";
}, {
    readonly id: 305;
    readonly signature: "vtabarg ::=";
}, {
    readonly id: 306;
    readonly signature: "vtabargtoken ::= ANY";
}, {
    readonly id: 307;
    readonly signature: "vtabargtoken ::= lp anylist RP";
}, {
    readonly id: 308;
    readonly signature: "lp ::= LP";
}, {
    readonly id: 309;
    readonly signature: "with ::= WITH wqlist";
}, {
    readonly id: 310;
    readonly signature: "with ::= WITH RECURSIVE wqlist";
}, {
    readonly id: 311;
    readonly signature: "wqas ::= AS";
}, {
    readonly id: 312;
    readonly signature: "wqas ::= AS MATERIALIZED";
}, {
    readonly id: 313;
    readonly signature: "wqas ::= AS NOT MATERIALIZED";
}, {
    readonly id: 314;
    readonly signature: "wqitem ::= withnm eidlist_opt wqas LP select RP";
}, {
    readonly id: 315;
    readonly signature: "withnm ::= nm";
}, {
    readonly id: 316;
    readonly signature: "wqlist ::= wqitem";
}, {
    readonly id: 317;
    readonly signature: "wqlist ::= wqlist COMMA wqitem";
}, {
    readonly id: 318;
    readonly signature: "windowdefn_list ::= windowdefn_list COMMA windowdefn";
}, {
    readonly id: 319;
    readonly signature: "windowdefn ::= nm AS LP window RP";
}, {
    readonly id: 320;
    readonly signature: "window ::= PARTITION BY nexprlist orderby_opt frame_opt";
}, {
    readonly id: 321;
    readonly signature: "window ::= nm PARTITION BY nexprlist orderby_opt frame_opt";
}, {
    readonly id: 322;
    readonly signature: "window ::= ORDER BY sortlist frame_opt";
}, {
    readonly id: 323;
    readonly signature: "window ::= nm ORDER BY sortlist frame_opt";
}, {
    readonly id: 324;
    readonly signature: "window ::= nm frame_opt";
}, {
    readonly id: 325;
    readonly signature: "frame_opt ::=";
}, {
    readonly id: 326;
    readonly signature: "frame_opt ::= range_or_rows frame_bound_s frame_exclude_opt";
}, {
    readonly id: 327;
    readonly signature: "frame_opt ::= range_or_rows BETWEEN frame_bound_s AND frame_bound_e frame_exclude_opt";
}, {
    readonly id: 328;
    readonly signature: "range_or_rows ::= RANGE|ROWS|GROUPS";
}, {
    readonly id: 329;
    readonly signature: "frame_bound_s ::= frame_bound";
}, {
    readonly id: 330;
    readonly signature: "frame_bound_s ::= UNBOUNDED PRECEDING";
}, {
    readonly id: 331;
    readonly signature: "frame_bound_e ::= frame_bound";
}, {
    readonly id: 332;
    readonly signature: "frame_bound_e ::= UNBOUNDED FOLLOWING";
}, {
    readonly id: 333;
    readonly signature: "frame_bound ::= expr PRECEDING|FOLLOWING";
}, {
    readonly id: 334;
    readonly signature: "frame_bound ::= CURRENT ROW";
}, {
    readonly id: 335;
    readonly signature: "frame_exclude_opt ::=";
}, {
    readonly id: 336;
    readonly signature: "frame_exclude_opt ::= EXCLUDE frame_exclude";
}, {
    readonly id: 337;
    readonly signature: "frame_exclude ::= NO OTHERS";
}, {
    readonly id: 338;
    readonly signature: "frame_exclude ::= CURRENT ROW";
}, {
    readonly id: 339;
    readonly signature: "frame_exclude ::= GROUP|TIES";
}, {
    readonly id: 340;
    readonly signature: "window_clause ::= WINDOW windowdefn_list";
}, {
    readonly id: 341;
    readonly signature: "filter_over ::= filter_clause over_clause";
}, {
    readonly id: 342;
    readonly signature: "filter_over ::= over_clause";
}, {
    readonly id: 343;
    readonly signature: "filter_over ::= filter_clause";
}, {
    readonly id: 344;
    readonly signature: "over_clause ::= OVER LP window RP";
}, {
    readonly id: 345;
    readonly signature: "over_clause ::= OVER nm";
}, {
    readonly id: 346;
    readonly signature: "filter_clause ::= FILTER LP WHERE expr RP";
}, {
    readonly id: 347;
    readonly signature: "term ::= QNUMBER";
}, {
    readonly id: 348;
    readonly signature: "input ::= cmdlist";
}, {
    readonly id: 349;
    readonly signature: "cmdlist ::= cmdlist ecmd";
}, {
    readonly id: 350;
    readonly signature: "cmdlist ::= ecmd";
}, {
    readonly id: 351;
    readonly signature: "ecmd ::= SEMI";
}, {
    readonly id: 352;
    readonly signature: "ecmd ::= cmdx SEMI";
}, {
    readonly id: 353;
    readonly signature: "ecmd ::= explain cmdx SEMI";
}, {
    readonly id: 354;
    readonly signature: "trans_opt ::=";
}, {
    readonly id: 355;
    readonly signature: "trans_opt ::= TRANSACTION";
}, {
    readonly id: 356;
    readonly signature: "trans_opt ::= TRANSACTION nm";
}, {
    readonly id: 357;
    readonly signature: "savepoint_opt ::= SAVEPOINT";
}, {
    readonly id: 358;
    readonly signature: "savepoint_opt ::=";
}, {
    readonly id: 359;
    readonly signature: "cmd ::= create_table create_table_args";
}, {
    readonly id: 360;
    readonly signature: "table_option_set ::= table_option";
}, {
    readonly id: 361;
    readonly signature: "columnlist ::= columnlist COMMA columnname carglist";
}, {
    readonly id: 362;
    readonly signature: "columnlist ::= columnname carglist";
}, {
    readonly id: 363;
    readonly signature: "nm ::= ID|INDEXED|JOIN_KW";
}, {
    readonly id: 364;
    readonly signature: "nm ::= STRING";
}, {
    readonly id: 365;
    readonly signature: "typetoken ::= typename";
}, {
    readonly id: 366;
    readonly signature: "typename ::= ID|STRING";
}, {
    readonly id: 367;
    readonly signature: "signed ::= plus_num";
}, {
    readonly id: 368;
    readonly signature: "signed ::= minus_num";
}, {
    readonly id: 369;
    readonly signature: "carglist ::= carglist ccons";
}, {
    readonly id: 370;
    readonly signature: "carglist ::=";
}, {
    readonly id: 371;
    readonly signature: "ccons ::= NULL onconf";
}, {
    readonly id: 372;
    readonly signature: "ccons ::= GENERATED ALWAYS AS generated";
}, {
    readonly id: 373;
    readonly signature: "ccons ::= AS generated";
}, {
    readonly id: 374;
    readonly signature: "conslist_opt ::= COMMA conslist";
}, {
    readonly id: 375;
    readonly signature: "conslist ::= conslist tconscomma tcons";
}, {
    readonly id: 376;
    readonly signature: "conslist ::= tcons";
}, {
    readonly id: 377;
    readonly signature: "tconscomma ::=";
}, {
    readonly id: 378;
    readonly signature: "defer_subclause_opt ::= defer_subclause";
}, {
    readonly id: 379;
    readonly signature: "resolvetype ::= raisetype";
}, {
    readonly id: 380;
    readonly signature: "selectnowith ::= oneselect";
}, {
    readonly id: 381;
    readonly signature: "oneselect ::= values";
}, {
    readonly id: 382;
    readonly signature: "sclp ::= selcollist COMMA";
}, {
    readonly id: 383;
    readonly signature: "as ::= ID|STRING";
}, {
    readonly id: 384;
    readonly signature: "indexed_opt ::= indexed_by";
}, {
    readonly id: 385;
    readonly signature: "returning ::=";
}, {
    readonly id: 386;
    readonly signature: "expr ::= term";
}, {
    readonly id: 387;
    readonly signature: "likeop ::= LIKE_KW|MATCH";
}, {
    readonly id: 388;
    readonly signature: "case_operand ::= expr";
}, {
    readonly id: 389;
    readonly signature: "exprlist ::= nexprlist";
}, {
    readonly id: 390;
    readonly signature: "nmnum ::= plus_num";
}, {
    readonly id: 391;
    readonly signature: "nmnum ::= nm";
}, {
    readonly id: 392;
    readonly signature: "nmnum ::= ON";
}, {
    readonly id: 393;
    readonly signature: "nmnum ::= DELETE";
}, {
    readonly id: 394;
    readonly signature: "nmnum ::= DEFAULT";
}, {
    readonly id: 395;
    readonly signature: "plus_num ::= INTEGER|FLOAT";
}, {
    readonly id: 396;
    readonly signature: "foreach_clause ::=";
}, {
    readonly id: 397;
    readonly signature: "foreach_clause ::= FOR EACH ROW";
}, {
    readonly id: 398;
    readonly signature: "tridxby ::=";
}, {
    readonly id: 399;
    readonly signature: "database_kw_opt ::= DATABASE";
}, {
    readonly id: 400;
    readonly signature: "database_kw_opt ::=";
}, {
    readonly id: 401;
    readonly signature: "kwcolumn_opt ::=";
}, {
    readonly id: 402;
    readonly signature: "kwcolumn_opt ::= COLUMNKW";
}, {
    readonly id: 403;
    readonly signature: "vtabarglist ::= vtabarg";
}, {
    readonly id: 404;
    readonly signature: "vtabarglist ::= vtabarglist COMMA vtabarg";
}, {
    readonly id: 405;
    readonly signature: "vtabarg ::= vtabarg vtabargtoken";
}, {
    readonly id: 406;
    readonly signature: "anylist ::=";
}, {
    readonly id: 407;
    readonly signature: "anylist ::= anylist LP anylist RP";
}, {
    readonly id: 408;
    readonly signature: "anylist ::= anylist ANY";
}, {
    readonly id: 409;
    readonly signature: "with ::=";
}, {
    readonly id: 410;
    readonly signature: "windowdefn_list ::= windowdefn";
}, {
    readonly id: 411;
    readonly signature: "window ::= frame_opt";
}];
export declare const lemonTables: {
    readonly nState: 600;
    readonly nRule: 412;
    readonly wildcard: 102;
    readonly minShiftReduce: 867;
    readonly maxShiftReduce: 1278;
    readonly minReduce: 1282;
    readonly maxReduce: 1693;
    readonly errorAction: 1279;
    readonly acceptAction: 1280;
    readonly noAction: 1281;
    readonly shiftCount: 599;
    readonly shiftMin: 0;
    readonly shiftMax: 2215;
    readonly reduceCount: 423;
    readonly reduceMin: -303;
    readonly reduceMax: 1825;
    readonly action: readonly [134, 131, 238, 290, 1662, 1660, 593, 1332, 1673, 1606, 593, 1315, 593, 7, 593, 1353, 590, 593, 579, 424, 1566, 134, 131, 238, 1318, 541, 1672, 477, 575, 1668, 84, 1005, 303, 1668, 84, 1668, 51, 1668, 63, 1006, 1668, 84, 498, 141, 142, 93, 442, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 424, 296, 1662, 498, 296, 1662, 567, 553, 296, 1662, 1306, 574, 1358, 1661, 590, 542, 579, 590, 574, 579, 548, 590, 1304, 579, 141, 142, 93, 576, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 399, 478, 395, 6, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 44, 342, 593, 305, 1127, 1280, 1, 1632, 599, 2, 1284, 598, 1200, 1284, 1200, 330, 424, 158, 330, 1613, 158, 390, 116, 308, 1366, 1668, 51, 1366, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 141, 142, 93, 515, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 1230, 329, 584, 296, 1662, 212, 296, 1662, 568, 1692, 488, 143, 1072, 1072, 1086, 1089, 590, 1195, 579, 590, 340, 579, 140, 140, 140, 140, 133, 392, 564, 536, 1195, 250, 425, 1195, 250, 137, 137, 136, 136, 136, 135, 132, 463, 291, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 966, 1230, 1231, 1230, 412, 965, 467, 412, 424, 467, 489, 357, 1611, 391, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 463, 134, 131, 238, 555, 1076, 141, 142, 93, 593, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 1317, 134, 131, 238, 424, 549, 1597, 1531, 333, 97, 1668, 83, 140, 140, 140, 140, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 141, 142, 93, 1657, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 591, 1230, 958, 958, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 44, 398, 547, 1306, 136, 136, 136, 135, 132, 463, 386, 593, 442, 595, 145, 1642, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 500, 1230, 112, 550, 460, 459, 1668, 51, 424, 296, 1662, 479, 334, 1259, 1230, 1231, 1230, 1599, 1261, 388, 312, 444, 590, 246, 579, 546, 1260, 271, 235, 329, 584, 551, 141, 142, 93, 429, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 1668, 22, 1230, 1262, 424, 1262, 216, 296, 1662, 98, 1230, 1231, 1230, 264, 884, 45, 528, 525, 524, 1041, 590, 1269, 579, 421, 420, 393, 523, 44, 141, 142, 93, 498, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 593, 1611, 561, 1230, 1231, 1230, 23, 264, 515, 200, 528, 525, 524, 127, 585, 509, 4, 355, 487, 506, 523, 593, 498, 1668, 84, 134, 131, 238, 329, 584, 588, 1627, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 1668, 19, 435, 1230, 1460, 297, 1662, 311, 424, 1565, 464, 1631, 599, 2, 1284, 437, 574, 1107, 590, 330, 579, 158, 582, 489, 357, 573, 593, 592, 1366, 409, 1274, 1230, 141, 142, 93, 1364, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 389, 1668, 84, 1062, 567, 1230, 313, 1523, 593, 125, 125, 970, 1230, 1231, 1230, 296, 1662, 126, 46, 464, 594, 464, 296, 1662, 1050, 1230, 218, 439, 590, 1604, 579, 1668, 84, 7, 403, 590, 515, 579, 325, 417, 1230, 1231, 1230, 250, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 1050, 1050, 1052, 1053, 35, 1275, 1230, 1231, 1230, 424, 1370, 993, 574, 371, 414, 274, 412, 1597, 467, 1302, 552, 451, 590, 543, 579, 1530, 1230, 1231, 1230, 1214, 201, 409, 1174, 141, 142, 93, 223, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 296, 1662, 1250, 593, 424, 296, 1662, 236, 529, 296, 1662, 515, 100, 590, 1600, 579, 48, 1605, 590, 1230, 579, 7, 590, 577, 579, 904, 1668, 84, 141, 142, 93, 496, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 1365, 1230, 296, 1662, 1250, 115, 1275, 326, 233, 539, 1062, 40, 282, 127, 585, 590, 4, 579, 329, 584, 1230, 1231, 1230, 1598, 593, 388, 904, 1051, 1356, 1661, 588, 1050, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 185, 593, 1230, 1668, 19, 1230, 971, 1597, 424, 1651, 464, 129, 908, 1195, 1230, 1231, 1230, 1325, 443, 1050, 1050, 1052, 582, 1603, 1668, 149, 1195, 7, 5, 1195, 1687, 410, 141, 142, 93, 1673, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 1214, 397, 593, 1062, 424, 1672, 1538, 50, 901, 125, 125, 1230, 1231, 1230, 1230, 1231, 1230, 126, 1230, 464, 594, 464, 515, 1230, 1050, 1668, 84, 3, 141, 142, 93, 924, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 1050, 1050, 1052, 1053, 35, 442, 457, 532, 433, 1230, 1062, 1361, 540, 1693, 1598, 925, 388, 7, 1129, 1230, 1231, 1230, 1129, 1536, 1230, 1231, 1230, 1051, 570, 1214, 593, 1050, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 6, 185, 1195, 1230, 231, 593, 382, 992, 424, 1668, 151, 510, 1213, 557, 482, 1195, 381, 160, 1195, 1050, 1050, 1052, 1230, 1231, 1230, 422, 593, 447, 1668, 84, 593, 217, 141, 142, 93, 593, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 1214, 1668, 19, 593, 424, 1668, 19, 442, 1063, 442, 1668, 19, 1230, 1231, 1230, 515, 445, 458, 1597, 386, 315, 1175, 1685, 556, 1685, 450, 1668, 84, 141, 142, 93, 505, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 442, 1147, 454, 1597, 362, 1041, 593, 462, 1460, 1233, 47, 1393, 324, 565, 1693, 115, 1148, 449, 7, 460, 459, 307, 375, 354, 593, 113, 593, 329, 584, 1668, 19, 1149, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 209, 1173, 563, 1668, 19, 1668, 19, 49, 424, 944, 1175, 1686, 1046, 1686, 218, 355, 484, 343, 210, 945, 569, 562, 1262, 1233, 1262, 490, 314, 423, 424, 1598, 1206, 388, 141, 142, 93, 440, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 352, 316, 531, 1658, 141, 142, 93, 549, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 446, 10, 1598, 274, 388, 915, 281, 299, 383, 534, 378, 533, 269, 593, 1206, 587, 1649, 1650, 374, 293, 1579, 991, 1173, 302, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 1668, 53, 520, 1250, 593, 1147, 1576, 431, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 1148, 301, 593, 1577, 593, 1307, 431, 1668, 54, 593, 268, 593, 461, 1649, 1650, 1149, 347, 492, 424, 135, 132, 463, 1146, 1195, 474, 1668, 68, 1668, 69, 550, 332, 287, 1668, 21, 1668, 55, 1195, 581, 424, 1195, 309, 1250, 141, 142, 93, 119, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 593, 237, 480, 1476, 141, 142, 93, 593, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 344, 430, 346, 1668, 70, 494, 991, 1132, 1132, 512, 1668, 56, 1269, 593, 268, 593, 369, 374, 593, 1666, 215, 384, 1624, 481, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 1668, 71, 1668, 72, 225, 1668, 73, 593, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 586, 431, 593, 872, 873, 874, 593, 911, 593, 1602, 1668, 74, 593, 7, 1460, 242, 593, 1666, 424, 1578, 472, 306, 364, 219, 367, 1668, 75, 430, 345, 1668, 57, 1668, 58, 432, 187, 1668, 59, 593, 424, 1668, 61, 1475, 141, 142, 93, 123, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 424, 570, 1668, 62, 141, 142, 93, 911, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 161, 384, 1624, 1474, 141, 130, 93, 441, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 267, 266, 265, 1460, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 593, 1336, 593, 1269, 1460, 384, 1624, 231, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 593, 163, 593, 1668, 76, 1668, 77, 593, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 475, 593, 483, 1668, 78, 1668, 20, 1249, 424, 491, 1668, 79, 495, 422, 295, 235, 1574, 38, 511, 896, 422, 335, 240, 422, 1668, 147, 112, 593, 424, 593, 101, 222, 991, 142, 93, 455, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 593, 39, 1668, 148, 1668, 80, 93, 551, 1254, 1254, 1085, 1088, 1075, 1075, 139, 139, 140, 140, 140, 140, 328, 923, 922, 1668, 64, 502, 1656, 1005, 933, 896, 124, 422, 121, 254, 593, 1006, 593, 226, 593, 127, 585, 164, 4, 16, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 588, 1668, 81, 1668, 65, 1668, 82, 593, 138, 138, 138, 138, 137, 137, 136, 136, 136, 135, 132, 463, 593, 226, 237, 966, 464, 593, 298, 593, 965, 593, 1668, 66, 593, 1170, 593, 411, 582, 353, 469, 115, 593, 471, 169, 1668, 173, 593, 44, 991, 1668, 174, 1668, 89, 1668, 67, 593, 1668, 85, 1668, 150, 1114, 1043, 593, 273, 1668, 86, 1062, 593, 503, 1668, 171, 593, 125, 125, 497, 593, 273, 336, 1668, 152, 126, 1335, 464, 594, 464, 1668, 146, 1050, 593, 545, 1668, 172, 593, 1054, 1668, 165, 256, 339, 1668, 156, 127, 585, 1586, 4, 329, 584, 499, 358, 273, 115, 348, 1668, 155, 930, 931, 1668, 153, 588, 1114, 1050, 1050, 1052, 1053, 35, 1554, 521, 593, 270, 1008, 1009, 9, 593, 372, 593, 115, 593, 168, 593, 115, 593, 1110, 464, 270, 996, 964, 273, 129, 1645, 1214, 1668, 154, 1054, 1404, 582, 1668, 88, 1668, 90, 1668, 87, 1668, 52, 1668, 60, 1405, 504, 537, 559, 1179, 961, 507, 129, 558, 127, 585, 1126, 4, 1126, 1125, 894, 1125, 162, 1062, 963, 359, 129, 1401, 363, 125, 125, 588, 366, 368, 370, 1349, 1334, 126, 1333, 464, 594, 464, 377, 387, 1050, 1391, 1414, 1618, 1459, 1387, 1399, 208, 580, 1464, 1314, 464, 243, 516, 1305, 1293, 1384, 1292, 1294, 1638, 288, 170, 228, 582, 12, 408, 321, 322, 241, 323, 245, 1446, 1050, 1050, 1052, 1053, 35, 559, 304, 350, 351, 501, 560, 127, 585, 1441, 4, 1451, 1434, 310, 1450, 526, 1062, 1332, 415, 380, 232, 1527, 125, 125, 588, 1214, 1396, 356, 1526, 583, 126, 1397, 464, 594, 464, 1641, 535, 1050, 1581, 1395, 1269, 1583, 1582, 213, 402, 277, 214, 227, 464, 1573, 239, 1571, 1266, 1394, 434, 198, 100, 224, 96, 183, 582, 191, 485, 193, 486, 194, 195, 196, 519, 1050, 1050, 1052, 1053, 35, 559, 113, 252, 413, 1447, 558, 493, 13, 1455, 416, 1453, 1452, 14, 202, 1521, 1062, 1532, 508, 258, 106, 514, 125, 125, 99, 1214, 1543, 289, 260, 206, 126, 365, 464, 594, 464, 361, 517, 1050, 261, 448, 1295, 262, 418, 1352, 1351, 108, 1350, 1655, 1654, 1343, 915, 419, 1322, 233, 452, 319, 379, 1321, 453, 1623, 320, 1320, 275, 1653, 544, 276, 1609, 1608, 1342, 1050, 1050, 1052, 1053, 35, 1630, 1218, 466, 385, 456, 300, 1419, 144, 1418, 570, 407, 407, 406, 284, 404, 11, 1508, 881, 396, 120, 127, 585, 394, 4, 1214, 327, 114, 1375, 1374, 220, 247, 400, 338, 401, 554, 42, 1224, 588, 596, 283, 337, 285, 286, 188, 597, 1290, 1285, 175, 1558, 176, 1559, 1557, 1556, 159, 317, 229, 177, 868, 230, 91, 465, 464, 221, 331, 468, 1165, 470, 473, 94, 244, 95, 249, 189, 582, 1124, 1122, 341, 427, 190, 178, 1249, 179, 43, 192, 947, 349, 428, 1138, 197, 251, 180, 181, 436, 102, 182, 438, 103, 104, 199, 248, 1140, 253, 1062, 105, 255, 1137, 166, 24, 125, 125, 257, 1264, 273, 360, 513, 259, 126, 15, 464, 594, 464, 204, 883, 1050, 518, 263, 373, 381, 92, 585, 1130, 4, 203, 205, 426, 107, 522, 25, 26, 329, 584, 913, 572, 527, 376, 588, 926, 530, 109, 184, 318, 167, 110, 27, 538, 1050, 1050, 1052, 1053, 35, 1211, 1091, 17, 476, 111, 1181, 234, 292, 1180, 464, 294, 207, 994, 129, 1201, 272, 1000, 28, 1197, 29, 30, 582, 1199, 1205, 1214, 31, 1204, 32, 1186, 41, 566, 33, 1105, 211, 8, 115, 1092, 1090, 1094, 34, 278, 578, 1095, 117, 122, 118, 1145, 36, 18, 128, 1062, 1055, 895, 957, 37, 589, 125, 125, 279, 186, 280, 1646, 157, 405, 126, 1220, 464, 594, 464, 1218, 466, 1050, 1219, 300, 1281, 1281, 1281, 1281, 407, 407, 406, 284, 404, 1281, 1281, 881, 1281, 300, 1281, 1281, 571, 1281, 407, 407, 406, 284, 404, 1281, 247, 881, 338, 1281, 1281, 1050, 1050, 1052, 1053, 35, 337, 1281, 1281, 1281, 247, 1281, 338, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 337, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1214, 1281, 1281, 1281, 1281, 1281, 1281, 249, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 178, 1281, 1281, 43, 1281, 1281, 249, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 178, 1281, 1281, 43, 1281, 1281, 248, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 248, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 426, 1281, 1281, 1281, 1281, 329, 584, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 426, 1281, 1281, 1281, 1281, 329, 584, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 476, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 1281, 476];
    readonly lookahead: readonly [277, 278, 279, 241, 242, 225, 195, 227, 195, 312, 195, 218, 195, 316, 195, 235, 254, 195, 256, 19, 297, 277, 278, 279, 218, 206, 213, 214, 206, 218, 219, 31, 206, 218, 219, 218, 219, 218, 219, 39, 218, 219, 195, 43, 44, 45, 195, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 19, 241, 242, 195, 241, 242, 195, 255, 241, 242, 195, 255, 237, 238, 254, 255, 256, 254, 255, 256, 264, 254, 207, 256, 43, 44, 45, 264, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 251, 287, 253, 215, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 82, 265, 195, 271, 11, 187, 188, 189, 190, 191, 192, 190, 87, 192, 89, 197, 19, 199, 197, 317, 199, 319, 25, 271, 206, 218, 219, 206, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 43, 44, 45, 195, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 60, 139, 140, 241, 242, 289, 241, 242, 309, 310, 294, 70, 47, 48, 49, 50, 254, 77, 256, 254, 195, 256, 55, 56, 57, 58, 59, 221, 88, 109, 90, 269, 240, 93, 269, 107, 108, 109, 110, 111, 112, 113, 114, 215, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 136, 117, 118, 119, 298, 141, 300, 298, 19, 300, 129, 130, 317, 318, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 114, 277, 278, 279, 146, 122, 43, 44, 45, 195, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 218, 277, 278, 279, 19, 19, 195, 286, 23, 68, 218, 219, 55, 56, 57, 58, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 43, 44, 45, 232, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 135, 60, 137, 138, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 82, 281, 206, 195, 109, 110, 111, 112, 113, 114, 195, 195, 195, 205, 22, 207, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 195, 60, 116, 117, 107, 108, 218, 219, 19, 241, 242, 121, 23, 116, 117, 118, 119, 306, 121, 308, 206, 234, 254, 15, 256, 195, 129, 259, 260, 139, 140, 145, 43, 44, 45, 200, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 218, 219, 60, 154, 19, 156, 265, 241, 242, 24, 117, 118, 119, 120, 21, 73, 123, 124, 125, 74, 254, 61, 256, 107, 108, 221, 133, 82, 43, 44, 45, 195, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 195, 317, 318, 117, 118, 119, 22, 120, 195, 22, 123, 124, 125, 19, 20, 284, 22, 128, 81, 288, 133, 195, 195, 218, 219, 277, 278, 279, 139, 140, 36, 195, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 218, 219, 62, 60, 195, 241, 242, 271, 19, 240, 60, 189, 190, 191, 192, 233, 255, 124, 254, 197, 256, 199, 72, 129, 130, 264, 195, 195, 206, 22, 23, 60, 43, 44, 45, 206, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 195, 218, 219, 101, 195, 60, 271, 162, 195, 107, 108, 109, 117, 118, 119, 241, 242, 115, 73, 117, 118, 119, 241, 242, 122, 60, 195, 266, 254, 312, 256, 218, 219, 316, 203, 254, 195, 256, 255, 208, 117, 118, 119, 269, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 154, 155, 156, 157, 158, 102, 117, 118, 119, 19, 242, 144, 255, 23, 206, 24, 298, 195, 300, 206, 195, 264, 254, 206, 256, 240, 117, 118, 119, 183, 22, 22, 23, 43, 44, 45, 151, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 241, 242, 60, 195, 19, 241, 242, 195, 23, 241, 242, 195, 152, 254, 310, 256, 243, 312, 254, 60, 256, 316, 254, 206, 256, 60, 218, 219, 43, 44, 45, 272, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 240, 60, 241, 242, 118, 25, 102, 255, 166, 167, 101, 22, 26, 19, 20, 254, 22, 256, 139, 140, 117, 118, 119, 306, 195, 308, 117, 118, 237, 238, 36, 122, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 195, 195, 60, 218, 219, 60, 109, 195, 19, 217, 60, 25, 23, 77, 117, 118, 119, 225, 233, 154, 155, 156, 72, 312, 218, 219, 90, 316, 22, 93, 303, 304, 43, 44, 45, 195, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 183, 195, 195, 101, 19, 213, 214, 243, 23, 107, 108, 117, 118, 119, 117, 118, 119, 115, 60, 117, 118, 119, 195, 60, 122, 218, 219, 22, 43, 44, 45, 35, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 154, 155, 156, 157, 158, 195, 255, 67, 195, 60, 101, 240, 311, 312, 306, 75, 308, 316, 29, 117, 118, 119, 33, 287, 117, 118, 119, 118, 146, 183, 195, 122, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 215, 195, 77, 60, 25, 195, 122, 144, 19, 218, 219, 66, 23, 88, 246, 90, 132, 25, 93, 154, 155, 156, 117, 118, 119, 257, 195, 131, 218, 219, 195, 265, 43, 44, 45, 195, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 183, 218, 219, 195, 19, 218, 219, 195, 23, 195, 218, 219, 117, 118, 119, 195, 233, 255, 195, 195, 233, 22, 23, 146, 25, 233, 218, 219, 43, 44, 45, 294, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 195, 12, 234, 195, 240, 74, 195, 255, 195, 60, 243, 262, 263, 311, 312, 25, 27, 19, 316, 107, 108, 265, 24, 265, 195, 150, 195, 139, 140, 218, 219, 42, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 233, 102, 67, 218, 219, 218, 219, 243, 19, 64, 22, 23, 23, 25, 195, 128, 129, 130, 233, 74, 233, 86, 154, 118, 156, 130, 265, 208, 19, 306, 95, 308, 43, 44, 45, 266, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 153, 230, 96, 232, 43, 44, 45, 19, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 114, 22, 306, 24, 308, 127, 120, 121, 122, 123, 124, 125, 126, 195, 147, 212, 213, 214, 132, 23, 195, 25, 102, 100, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 218, 219, 19, 60, 195, 12, 210, 211, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 27, 134, 195, 195, 195, 210, 211, 218, 219, 195, 47, 195, 212, 213, 214, 42, 16, 130, 19, 112, 113, 114, 23, 77, 195, 218, 219, 218, 219, 117, 163, 164, 218, 219, 218, 219, 90, 64, 19, 93, 153, 118, 43, 44, 45, 160, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 195, 119, 272, 276, 43, 44, 45, 195, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 78, 116, 80, 218, 219, 116, 144, 128, 129, 130, 218, 219, 61, 195, 47, 195, 16, 132, 195, 263, 195, 314, 315, 267, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 218, 219, 218, 219, 151, 218, 219, 195, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 210, 211, 195, 7, 8, 9, 195, 60, 195, 312, 218, 219, 195, 316, 195, 120, 195, 263, 19, 195, 125, 267, 78, 24, 80, 218, 219, 116, 162, 218, 219, 218, 219, 301, 302, 218, 219, 195, 19, 218, 219, 276, 43, 44, 45, 160, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 19, 146, 218, 219, 43, 44, 45, 118, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 165, 314, 315, 276, 43, 44, 45, 266, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 128, 129, 130, 195, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 195, 228, 195, 61, 195, 314, 315, 25, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 195, 22, 195, 218, 219, 218, 219, 195, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 195, 195, 246, 218, 219, 218, 219, 25, 19, 246, 218, 219, 246, 257, 259, 260, 195, 22, 266, 60, 257, 195, 120, 257, 218, 219, 116, 195, 19, 195, 150, 151, 25, 44, 45, 266, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 195, 54, 218, 219, 218, 219, 45, 145, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 246, 121, 122, 218, 219, 19, 23, 31, 25, 118, 159, 257, 161, 24, 195, 39, 195, 143, 195, 19, 20, 22, 22, 24, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 36, 218, 219, 218, 219, 218, 219, 195, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 195, 143, 119, 136, 60, 195, 22, 195, 141, 195, 218, 219, 195, 23, 195, 25, 72, 23, 131, 25, 195, 134, 23, 218, 219, 195, 82, 144, 218, 219, 218, 219, 218, 219, 195, 218, 219, 218, 219, 60, 23, 195, 25, 218, 219, 101, 195, 117, 218, 219, 195, 107, 108, 23, 195, 25, 195, 218, 219, 115, 228, 117, 118, 119, 218, 219, 122, 195, 19, 218, 219, 195, 60, 218, 219, 142, 195, 218, 219, 19, 20, 195, 22, 139, 140, 23, 23, 25, 25, 195, 218, 219, 7, 8, 218, 219, 36, 118, 154, 155, 156, 157, 158, 195, 23, 195, 25, 84, 85, 49, 195, 23, 195, 25, 195, 23, 195, 25, 195, 23, 60, 25, 23, 23, 25, 25, 142, 183, 218, 219, 118, 195, 72, 218, 219, 218, 219, 218, 219, 218, 219, 218, 219, 195, 195, 146, 86, 98, 23, 195, 25, 91, 19, 20, 154, 22, 156, 154, 23, 156, 25, 101, 23, 195, 25, 195, 195, 107, 108, 36, 195, 195, 195, 195, 228, 115, 195, 117, 118, 119, 195, 195, 122, 261, 195, 321, 195, 195, 195, 258, 238, 195, 195, 60, 299, 291, 195, 195, 258, 195, 195, 195, 290, 244, 216, 72, 245, 193, 258, 258, 299, 258, 299, 274, 154, 155, 156, 157, 158, 86, 247, 295, 248, 295, 91, 19, 20, 270, 22, 274, 270, 248, 274, 222, 101, 227, 274, 221, 231, 221, 107, 108, 36, 183, 262, 247, 221, 283, 115, 262, 117, 118, 119, 198, 116, 122, 220, 262, 61, 220, 220, 251, 247, 142, 251, 245, 60, 202, 299, 202, 38, 262, 202, 22, 152, 151, 296, 43, 72, 236, 18, 239, 202, 239, 239, 239, 18, 154, 155, 156, 157, 158, 86, 150, 201, 248, 275, 91, 248, 273, 236, 248, 275, 275, 273, 236, 248, 101, 286, 202, 201, 159, 63, 107, 108, 296, 183, 293, 202, 201, 22, 115, 202, 117, 118, 119, 292, 223, 122, 201, 65, 202, 201, 223, 220, 220, 22, 220, 226, 226, 229, 127, 223, 220, 166, 24, 285, 220, 222, 114, 315, 285, 220, 202, 220, 307, 92, 320, 320, 229, 154, 155, 156, 157, 158, 0, 1, 2, 223, 83, 5, 268, 149, 268, 146, 10, 11, 12, 13, 14, 22, 280, 17, 202, 159, 19, 20, 251, 22, 183, 282, 148, 252, 252, 250, 30, 249, 32, 248, 147, 25, 13, 36, 204, 196, 40, 196, 6, 302, 194, 194, 194, 209, 215, 209, 215, 215, 215, 224, 224, 216, 209, 4, 216, 215, 3, 60, 22, 122, 19, 122, 19, 125, 22, 15, 22, 71, 16, 72, 23, 23, 140, 305, 152, 79, 25, 131, 82, 143, 20, 16, 305, 1, 143, 145, 131, 131, 62, 54, 131, 37, 54, 54, 152, 99, 117, 34, 101, 54, 24, 1, 5, 22, 107, 108, 116, 76, 25, 162, 41, 142, 115, 24, 117, 118, 119, 116, 20, 122, 19, 126, 23, 132, 19, 20, 69, 22, 69, 22, 134, 22, 68, 22, 22, 139, 140, 60, 141, 68, 24, 36, 28, 97, 22, 37, 68, 23, 150, 34, 22, 154, 155, 156, 157, 158, 23, 23, 22, 163, 25, 23, 142, 23, 98, 60, 23, 22, 144, 25, 76, 34, 117, 34, 89, 34, 34, 72, 87, 76, 183, 34, 94, 34, 23, 22, 24, 34, 23, 25, 44, 25, 23, 23, 23, 22, 22, 25, 11, 143, 25, 143, 23, 22, 22, 22, 101, 23, 23, 136, 22, 25, 107, 108, 142, 25, 142, 142, 23, 15, 115, 1, 117, 118, 119, 1, 2, 122, 1, 5, 322, 322, 322, 322, 10, 11, 12, 13, 14, 322, 322, 17, 322, 5, 322, 322, 141, 322, 10, 11, 12, 13, 14, 322, 30, 17, 32, 322, 322, 154, 155, 156, 157, 158, 40, 322, 322, 322, 30, 322, 32, 322, 322, 322, 322, 322, 322, 322, 40, 322, 322, 322, 322, 322, 322, 322, 322, 322, 183, 322, 322, 322, 322, 322, 322, 71, 322, 322, 322, 322, 322, 322, 322, 79, 322, 322, 82, 322, 322, 71, 322, 322, 322, 322, 322, 322, 322, 79, 322, 322, 82, 322, 322, 99, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 99, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 134, 322, 322, 322, 322, 139, 140, 322, 322, 322, 322, 322, 322, 322, 134, 322, 322, 322, 322, 139, 140, 322, 322, 322, 322, 322, 322, 322, 322, 163, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 163, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 322, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187];
    readonly shiftOffset: readonly [2201, 1973, 2215, 1552, 1552, 33, 368, 1668, 1741, 1814, 726, 726, 726, 265, 33, 33, 33, 33, 33, 0, 0, 216, 1349, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 272, 272, 111, 111, 316, 365, 516, 867, 867, 916, 916, 916, 916, 40, 112, 260, 364, 408, 512, 617, 661, 765, 809, 913, 957, 1061, 1081, 1195, 1215, 1329, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1349, 1369, 1349, 1473, 1493, 1493, 473, 1974, 2082, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 726, 138, 232, 232, 232, 232, 232, 232, 232, 188, 99, 242, 718, 416, 1159, 867, 867, 940, 940, 867, 1103, 417, 574, 574, 574, 611, 139, 139, 2379, 2379, 1026, 1026, 1026, 536, 466, 466, 466, 466, 1017, 1017, 849, 718, 971, 1060, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 261, 712, 712, 867, 108, 1142, 1142, 977, 1108, 1108, 977, 977, 1243, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 641, 789, 789, 635, 366, 721, 673, 782, 494, 787, 829, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 959, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 867, 820, 820, 820, 867, 867, 867, 1136, 867, 867, 867, 1119, 1007, 867, 1169, 867, 867, 867, 867, 867, 867, 867, 867, 1225, 1153, 869, 196, 618, 618, 618, 618, 1491, 196, 196, 91, 339, 1326, 1386, 383, 1163, 1364, 1426, 1364, 1538, 903, 1163, 1163, 903, 1163, 1426, 1538, 1018, 1535, 1241, 1528, 1528, 1528, 1394, 1394, 1394, 1394, 762, 762, 1403, 1466, 1475, 1551, 1746, 1805, 1746, 1746, 1729, 1729, 1840, 1840, 1729, 1730, 1732, 1859, 1842, 1870, 1870, 1870, 1870, 1729, 1876, 1751, 1732, 1732, 1751, 1859, 1842, 1751, 1842, 1751, 1729, 1876, 1760, 1857, 1729, 1876, 1906, 1729, 1876, 1729, 1876, 1906, 1746, 1746, 1746, 1873, 1922, 1922, 1906, 1746, 1822, 1746, 1873, 1746, 1746, 1786, 1929, 1843, 1843, 1906, 1729, 1872, 1872, 1894, 1894, 1831, 1836, 1966, 1729, 1833, 1831, 1851, 1860, 1751, 1983, 1996, 1996, 2009, 2009, 2009, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 2379, 136, 1063, 1196, 530, 636, 1274, 1300, 1443, 1598, 1495, 1479, 967, 1083, 1602, 463, 1625, 1638, 1670, 1541, 1671, 1689, 1696, 1277, 1432, 1693, 808, 1700, 1607, 1657, 1587, 1704, 1707, 1631, 1708, 1733, 1608, 1611, 1743, 1747, 1620, 1592, 2026, 2030, 2013, 1914, 2018, 1916, 2020, 2019, 2021, 1915, 2027, 2029, 2024, 2025, 1909, 1899, 1923, 2028, 2028, 1913, 2037, 1917, 2042, 2059, 1918, 1932, 2028, 1933, 2003, 2031, 2028, 1919, 2012, 2015, 2016, 2022, 1936, 1956, 2040, 2053, 2077, 2074, 2058, 1967, 1924, 2034, 2060, 2036, 2008, 2046, 1946, 1978, 2066, 2075, 2078, 1968, 1972, 2084, 2041, 2086, 2088, 2076, 2089, 2048, 2054, 2093, 2023, 2091, 2099, 2055, 2085, 2101, 2092, 1975, 2105, 2110, 2111, 2112, 2115, 2113, 2043, 1997, 2117, 2120, 2032, 2114, 2122, 2001, 2121, 2116, 2118, 2119, 2124, 2062, 2071, 2068, 2123, 2080, 2065, 2126, 2138, 2140, 2139, 2141, 2143, 2130, 2033, 2035, 2142, 2121, 2146, 2147, 2148, 2150, 2149, 2152, 2156, 2151, 2164, 2158, 2159, 2161, 2162, 2160, 2165, 2163, 2050, 2049, 2051, 2052, 2167, 2172, 2181, 2197, 2204];
    readonly reduceOffset: readonly [-67, 345, -64, -178, -181, 143, 435, -78, -183, 163, -185, 284, 384, -174, 189, 352, 440, 444, 493, -23, 227, -277, -1, 305, 561, 755, 759, 764, -189, 839, 857, 354, 484, 859, 631, 67, 734, 780, -187, 616, 581, 730, 891, 449, 588, 795, 836, -238, 287, -238, 287, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 205, 582, 715, 958, 985, 1003, 1005, 1010, 1012, 1059, 1066, 1092, 1094, 1097, 1122, 1137, 1141, 1143, 1147, 1151, 1172, 1249, 1251, 1269, 1271, 1276, 1290, 1316, 1318, 1337, 1371, 1373, 1375, 1400, 1413, 1418, 1420, 1422, 1425, 1427, 1433, 1438, 1447, 1454, 1459, 1463, 1467, 1480, 1484, 1518, 1523, 1525, 1527, 1529, 1531, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 155, 210, -220, 86, -130, 943, 996, 402, -256, -113, 981, 1095, 1135, 395, -256, -256, -256, -256, 568, 568, 568, -4, -153, -133, 259, 306, -166, 523, -303, -126, 503, 503, -37, -149, 164, 690, 292, 412, 492, 651, 784, 332, 786, 841, 1149, 833, 1236, 792, 162, 796, 1253, 777, 288, 381, 380, 709, 487, 1027, 972, 1030, 1084, 991, 1120, -152, 1062, 692, 1240, 1247, 1250, 1239, 1306, -207, -194, 57, 180, 74, 315, 355, 376, 452, 488, 630, 693, 965, 1004, 1025, 1099, 1154, 1289, 1305, 1310, 1469, 1489, 984, 1494, 1502, 1516, 1544, 1556, 1557, 1562, 1576, 1578, 1579, 1583, 1584, 1585, 1586, 1217, 1440, 1554, 1589, 1593, 1594, 1530, 1597, 1599, 1600, 1539, 1472, 1601, 1560, 1604, 355, 1605, 1609, 1610, 1612, 1613, 1614, 1503, 1512, 1520, 1567, 1548, 1558, 1559, 1561, 1530, 1567, 1567, 1569, 1596, 1622, 1519, 1521, 1547, 1565, 1581, 1568, 1534, 1582, 1563, 1566, 1591, 1570, 1606, 1536, 1619, 1615, 1616, 1624, 1626, 1633, 1590, 1595, 1603, 1617, 1618, 1621, 1572, 1623, 1628, 1663, 1644, 1577, 1647, 1648, 1673, 1675, 1588, 1627, 1678, 1630, 1629, 1634, 1651, 1650, 1652, 1653, 1654, 1688, 1701, 1655, 1635, 1636, 1658, 1639, 1672, 1661, 1677, 1666, 1715, 1717, 1632, 1642, 1724, 1726, 1712, 1728, 1736, 1737, 1739, 1718, 1722, 1723, 1725, 1719, 1720, 1721, 1727, 1731, 1734, 1735, 1738, 1740, 1742, 1643, 1656, 1669, 1674, 1753, 1759, 1645, 1646, 1711, 1713, 1748, 1744, 1709, 1789, 1716, 1749, 1752, 1755, 1758, 1807, 1816, 1818, 1823, 1824, 1825, 1745, 1754, 1714, 1811, 1806, 1808, 1809, 1810, 1813, 1802, 1803, 1812, 1815, 1817, 1820];
    readonly defaults: readonly [1691, 1691, 1691, 1516, 1279, 1392, 1279, 1279, 1279, 1279, 1516, 1516, 1516, 1279, 1279, 1279, 1279, 1279, 1279, 1422, 1422, 1568, 1312, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1515, 1279, 1279, 1279, 1279, 1607, 1607, 1279, 1279, 1279, 1279, 1279, 1592, 1591, 1279, 1279, 1279, 1431, 1279, 1279, 1279, 1438, 1279, 1279, 1279, 1279, 1279, 1517, 1518, 1279, 1279, 1279, 1279, 1567, 1569, 1533, 1445, 1444, 1443, 1442, 1551, 1410, 1436, 1429, 1433, 1512, 1513, 1511, 1670, 1518, 1517, 1279, 1432, 1480, 1496, 1479, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1488, 1495, 1494, 1493, 1502, 1492, 1489, 1482, 1481, 1483, 1484, 1303, 1300, 1354, 1279, 1279, 1279, 1279, 1279, 1485, 1312, 1473, 1472, 1471, 1279, 1499, 1486, 1498, 1497, 1575, 1644, 1643, 1534, 1279, 1279, 1279, 1279, 1279, 1279, 1607, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1412, 1607, 1607, 1279, 1312, 1607, 1607, 1308, 1413, 1413, 1308, 1308, 1416, 1587, 1383, 1383, 1383, 1383, 1392, 1383, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1572, 1570, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1388, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1637, 1683, 1279, 1546, 1368, 1388, 1388, 1388, 1388, 1390, 1369, 1367, 1382, 1313, 1286, 1683, 1683, 1448, 1437, 1389, 1437, 1680, 1435, 1448, 1448, 1435, 1448, 1389, 1680, 1329, 1659, 1324, 1422, 1422, 1422, 1412, 1412, 1412, 1412, 1416, 1416, 1514, 1389, 1382, 1279, 1355, 1683, 1355, 1355, 1398, 1398, 1682, 1682, 1398, 1534, 1667, 1457, 1357, 1363, 1363, 1363, 1363, 1398, 1297, 1435, 1667, 1667, 1435, 1457, 1357, 1435, 1357, 1435, 1398, 1297, 1550, 1678, 1398, 1297, 1524, 1398, 1297, 1398, 1297, 1524, 1355, 1355, 1355, 1344, 1279, 1279, 1524, 1355, 1329, 1355, 1344, 1355, 1355, 1625, 1279, 1528, 1528, 1524, 1398, 1617, 1617, 1425, 1425, 1430, 1416, 1519, 1398, 1279, 1430, 1428, 1426, 1435, 1347, 1640, 1640, 1636, 1636, 1636, 1688, 1688, 1587, 1652, 1312, 1312, 1312, 1312, 1652, 1331, 1331, 1313, 1313, 1312, 1652, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1647, 1279, 1279, 1535, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1402, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1593, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1462, 1279, 1282, 1584, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1439, 1440, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1454, 1279, 1279, 1279, 1449, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1403, 1279, 1279, 1279, 1279, 1279, 1279, 1549, 1548, 1279, 1279, 1400, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1327, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1427, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1622, 1417, 1279, 1279, 1279, 1279, 1671, 1279, 1279, 1279, 1279, 1377, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1279, 1663, 1371, 1463, 1279, 1466, 1301, 1279, 1291, 1279, 1279];
    readonly fallback: readonly [0, 0, 60, 60, 60, 60, 0, 60, 60, 60, 0, 60, 60, 60, 60, 0, 0, 0, 60, 0, 0, 60, 0, 0, 0, 0, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 0, 0, 0, 0, 60, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    readonly ruleLhs: readonly [191, 191, 190, 192, 193, 193, 193, 193, 192, 192, 192, 192, 192, 197, 199, 201, 201, 200, 200, 198, 198, 205, 205, 207, 207, 208, 210, 210, 210, 211, 215, 216, 217, 217, 217, 217, 217, 217, 217, 217, 217, 217, 217, 217, 217, 226, 226, 222, 222, 224, 224, 227, 227, 227, 227, 228, 228, 228, 228, 228, 225, 225, 229, 229, 229, 204, 231, 232, 232, 232, 232, 232, 235, 220, 220, 236, 236, 237, 237, 192, 239, 239, 192, 192, 192, 206, 206, 206, 241, 244, 244, 244, 242, 242, 254, 242, 256, 256, 245, 245, 245, 257, 246, 246, 246, 258, 258, 247, 247, 260, 260, 259, 259, 259, 259, 259, 202, 202, 240, 240, 265, 265, 265, 265, 261, 261, 261, 261, 262, 262, 262, 267, 263, 263, 251, 251, 233, 233, 221, 221, 221, 268, 268, 268, 249, 249, 250, 250, 252, 252, 252, 252, 192, 248, 248, 270, 270, 270, 270, 192, 271, 271, 271, 271, 192, 192, 274, 274, 274, 274, 274, 274, 275, 272, 272, 273, 273, 266, 266, 219, 219, 219, 219, 218, 218, 218, 219, 219, 219, 219, 219, 219, 219, 219, 219, 218, 219, 219, 219, 219, 219, 219, 219, 219, 219, 277, 219, 219, 219, 219, 219, 219, 219, 219, 219, 219, 219, 219, 278, 278, 219, 279, 279, 219, 219, 219, 219, 219, 219, 282, 282, 283, 283, 281, 264, 255, 255, 280, 280, 192, 284, 284, 223, 223, 234, 234, 285, 285, 192, 192, 192, 286, 286, 192, 192, 192, 192, 192, 213, 214, 192, 288, 290, 290, 290, 291, 291, 291, 293, 293, 289, 289, 295, 295, 294, 294, 294, 294, 219, 219, 238, 238, 238, 192, 192, 192, 297, 297, 192, 192, 192, 192, 192, 192, 298, 192, 192, 192, 192, 192, 192, 192, 192, 192, 300, 302, 303, 303, 304, 269, 269, 307, 307, 307, 306, 308, 243, 243, 309, 310, 311, 311, 311, 311, 311, 312, 312, 312, 316, 318, 318, 319, 319, 317, 317, 320, 320, 321, 321, 321, 253, 276, 276, 276, 315, 315, 314, 218, 187, 188, 188, 189, 189, 189, 194, 194, 194, 196, 196, 192, 205, 203, 203, 195, 195, 210, 211, 212, 212, 209, 209, 217, 217, 217, 204, 230, 230, 231, 235, 237, 241, 242, 257, 258, 267, 275, 219, 277, 281, 264, 287, 287, 287, 287, 287, 213, 292, 292, 295, 296, 296, 299, 299, 301, 301, 302, 305, 305, 305, 269, 309, 311];
    readonly ruleNrhs: readonly [-1, -3, -1, -3, 0, -1, -1, -1, -2, -2, -2, -3, -5, -6, -1, 0, -3, -1, 0, -5, -2, 0, -3, -2, -1, -2, 0, -4, -6, -2, 0, 0, -2, -3, -4, -4, -4, -3, -3, -5, -2, -4, -4, -1, -2, -3, -4, 0, -1, 0, -2, -2, -3, -3, -3, -2, -2, -1, -1, -2, -3, -2, 0, -2, -2, 0, -1, -2, -7, -5, -5, -10, 0, 0, -3, 0, -2, -1, -1, -4, -2, 0, -9, -4, -1, -3, -4, -1, -3, -1, -2, -1, -9, -10, -4, -1, -5, -5, -1, -1, 0, 0, -5, -3, -5, -2, 0, 0, -2, -2, 0, -5, -6, -8, -6, -6, 0, -2, -1, -3, -1, -3, -3, -5, -1, -2, -3, -4, -2, -4, 0, 0, -3, -2, 0, -3, -5, -3, -1, -1, 0, -2, -2, 0, 0, -3, 0, -2, 0, -2, -4, -4, -6, 0, -2, 0, -2, -2, -4, -9, -5, -7, -3, -5, -7, -8, 0, -2, -12, -9, -5, -8, -2, -2, -1, 0, -3, -3, -1, -3, -1, -3, -5, -1, -1, -1, -1, -3, -6, -5, -8, -4, -6, -9, -5, -1, -5, -3, -3, -3, -3, -3, -3, -3, -3, -2, -3, -5, -2, -3, -3, -4, -6, -5, -2, -2, -2, -3, -1, -2, -5, -1, -2, -5, -3, -5, -5, -4, -5, -5, -4, -2, 0, 0, 0, -3, -1, 0, -3, -12, -1, 0, 0, -3, -5, -3, 0, -2, -4, -2, -3, -2, 0, -3, -5, -6, -5, -6, -2, -2, -5, -11, -1, -2, 0, -1, -1, -3, 0, -2, -3, -2, -3, -2, -9, -8, -6, -3, -4, -6, -1, -1, -1, -4, -6, -3, 0, -2, -1, -3, -1, -3, -6, -2, -7, -6, -8, -6, -9, -10, -11, -9, -1, -4, -8, 0, -1, -3, -1, -2, -3, -1, -2, -3, -6, -1, -1, -3, -3, -5, -5, -6, -4, -5, -2, 0, -3, -6, -1, -1, -2, -1, -2, -2, -2, 0, -2, -2, -2, -1, -2, -2, -1, -1, -4, -2, -5, -1, -1, -2, -1, -1, -2, -3, 0, -1, -2, -1, 0, -2, -1, -4, -2, -1, -1, -1, -1, -1, -1, -2, 0, -2, -4, -2, -2, -3, -1, 0, -1, -1, -1, -1, -2, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, -3, 0, -1, 0, 0, -1, -1, -3, -2, 0, -4, -2, 0, -1, -1];
};
