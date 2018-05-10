import { ISelect, IError } from "../../interfaces";
import { Helper } from "./helper";
import { LogHelper } from "../../log_helper";
import { ERROR_TYPE, IDB_MODE, QUERY_OPTION } from "../../enums";

export class Instance extends Helper {
   
    constructor(query: ISelect, onSuccess: (results: object[]) => void, onError: (err: IError) => void) {
        super();
        this.onError = onError;
        this.onSuccess = onSuccess;
        this.query = query;
        this.skipRecord = query.skip;
        this.limitRecord = query.limit;
        this.tableName = query.from as string;
    }

    execute() {
        if (this.isTableExist(this.tableName) === true) {
            try {
                if (this.query.where !== undefined) {
                    this.addGreatAndLessToNotOp();
                    this.initTransaction_();
                    if (Array.isArray(this.query.where)) {
                        this.processWhereArrayQry();
                    }
                    else {
                        this.processWhere_();
                    }
                }
                else {
                    this.initTransaction_();
                    this.executeWhereUndefinedLogic();
                }
            }
            catch (ex) {
                this.errorOccured = true;
                this.onExceptionOccured(ex, { TableName: this.query.from });
            }
        }
        else {
            this.errorOccured = true;
            this.onErrorOccured(
                new LogHelper(ERROR_TYPE.TableNotExist, { TableName: this.query.from }),
                true
            );
        }
    }

    private processWhereArrayQry() {
        this.isArrayQry = true;
        const wherequery = this.query.where,
            pKey = this.getPrimaryKey(this.query.from);
        let isFirstWhere = true, output = [], operation;

        const isItemExist = (keyValue) => {
            let isExist = false;
            output.every((item) => {
                if (item[pKey] === keyValue) {
                    isExist = true;
                    return false;
                }
                return true;
            });
            return isExist;
        };
        const onSuccess = () => {
            if (operation === QUERY_OPTION.And) {
                const doAnd = () => {
                    let andResults = [];
                    this.results.forEach((item) => {
                        if (isItemExist(item[pKey])) {
                            andResults.push(item);
                        }
                    });
                    output = andResults;
                    andResults = null;
                };
                if (output.length > 0) {
                    doAnd();
                }
                else if (isFirstWhere === true) {
                    output = this.results;
                }
                else {
                    doAnd();
                }
            }
            else {
                if (output.length > 0) {
                    this.results = [...output, ...this.results];
                    this.removeDuplicates();
                    output = this.results;
                }
                else {
                    output = this.results;
                }
            }
            if (wherequery.length > 0) {
                this.results = [];
                processFirstQry();
            }
            else {
                this.results = output;
            }
            isFirstWhere = false;
        };
        const processFirstQry = () => {
            this.query.where = wherequery.shift();
            if (this.query.where['or']) {
                if (Object.keys(this.query.where).length === 1) {
                    operation = 'or';
                    this.query.where = this.query.where['or'];
                    this.onWhereArrayQrySuccess = onSuccess;
                }
                else {
                    operation = 'and';
                    this.onWhereArrayQrySuccess = onSuccess;
                }
            }
            else {
                operation = 'and';
                this.onWhereArrayQrySuccess = onSuccess;
            }
            this.processWhere_();
        };
        processFirstQry();
    }

    protected onQueryFinished() {
        if (this.isOr === true) {
            this.orQuerySuccess_();
        }
        else if (this.isArrayQry === true) {
            this.onWhereArrayQrySuccess();
        }
        else if (this.isTransaction === true) {
            this.onTransactionCompleted_();
        }
    }

    private initTransaction_() {
        this.createTransaction([this.tableName], this.onTransactionCompleted_, IDB_MODE.ReadOnly);
        this.objectStore = this.transaction.objectStore(this.tableName);
    }

    private processWhere_() {
        if (this.query.where.or) {
            this.processOrLogic_();
        }
        this.goToWhereLogic();
    }

    private onTransactionCompleted_ = () => {
        if (this.errorOccured === false) {
            this.processOrderBy();
            if (this.query.distinct) {
                const groupBy = [];
                const result = this.results[0];
                for (const key in result) {
                    groupBy.push(key);
                }
                const primaryKey = this.getPrimaryKey(this.query.from),
                    index = groupBy.indexOf(primaryKey);
                groupBy.splice(index, 1);
                this.query.groupBy = groupBy.length > 0 ? groupBy : null;
            }
            if (this.query.groupBy) {
                if (this.query.aggregate) {
                    this.executeAggregateGroupBy();
                }
                else {
                    this.processGroupBy();
                }
            }
            else if (this.query.aggregate) {
                this.processAggregateQry();
            }
            this.onSuccess(this.results);
        }
    }

    private orQueryFinish_() {
        this.isOr = false;
        this.results = this.orInfo.results;
        // free or info memory
        this.orInfo = undefined;
        this.removeDuplicates();
        this.onQueryFinished();
    }

    private orQuerySuccess_() {
        this.orInfo.results = [... this.orInfo.results, ...this.results];
        if (!this.query.limit || (this.query.limit > this.orInfo.results.length)) {
            this.results = [];
            const key = this.getObjectFirstKey(this.orInfo.orQuery);
            if (key != null) {
                const where = {};
                where[key] = this.orInfo.orQuery[key];
                delete this.orInfo.orQuery[key];
                this.query.where = where;
                this.goToWhereLogic();
            }
            else {
                this.orQueryFinish_();
            }
        }
        else {
            this.orQueryFinish_();
        }
    }

    private processOrLogic_() {
        this.isOr = true;
        this.orInfo = {
            orQuery: this.query.where.or,
            results: []
        };
        // free or memory
        delete this.query.where.or;
    }
}