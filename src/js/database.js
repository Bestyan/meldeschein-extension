import localStorageDB from 'localstoragedb';
import util from './data_utils';
import constants from './constants';

const LOCALSTORAGE_LAST_UPLOAD = "xls_upload_datetime";

const TABLE_RAW = "raw_data";
const TABLE_SEARCH = "clean_data";
const TABLE_NAME_TO_GENDER = "name_to_gender";

// columns of the SEARCH table
const COLUMNS_SEARCH = ["vorname", "nachname", "anschrift", "strasse", "plz", "ort", "land", "anreise", "abreise", "apartment", "personen", "vermerk", "email"];

const DB = new localStorageDB("meldeschein", localStorage);

export default {
    xls_upload_datetime: window.localStorage.getItem(LOCALSTORAGE_LAST_UPLOAD),

    setup(refreshStatusFunc) {
        this.refreshStatus = refreshStatusFunc;
    },

    resetDB() {
        if (DB.tableExists(TABLE_RAW)) {
            DB.dropTable(TABLE_RAW);
        }
        if (DB.tableExists(TABLE_SEARCH)) {
            DB.dropTable(TABLE_SEARCH);
        }

        // TEMPORARY
        if (DB.tableExists(TABLE_NAME_TO_GENDER)) {
            DB.dropTable(TABLE_NAME_TO_GENDER);
        }
    },

    /**
     * sets up db for use
     * @param {JSON} rows 
     */
    initDB(rows) {
        /*
        clear old data and create table
        */
        this.resetDB();
        DB.createTableWithData(TABLE_RAW, rows);
        DB.createTable(TABLE_SEARCH, COLUMNS_SEARCH);

        let raw_rows = DB.queryAll(TABLE_RAW);
        raw_rows.forEach(row => {
            let data = {
                ...util.processKunde(row.Kunde), // extract vorname, nachname from Kunde
                anschrift: row.Anschrift,
                ...util.processAnschrift(row.Anschrift), // extract strasse, plz, ort, land
                anreise: row.Anreise.toLocaleDateString("de-DE", constants.SEARCH_RESULT_DATE_FORMAT),
                abreise: row.Abreise.toLocaleDateString("de-DE", constants.SEARCH_RESULT_DATE_FORMAT),
                apartment: util.processApartment(row.Name_der_gebuchten_Leistung),
                personen: row.Personen,
                vermerk: row.Interner_Vermerk,
                email: row.EMail
            };

            // insert row
            DB.insert(TABLE_SEARCH, data);
            DB.commit();

        });
        this.setUploadTime();

        this.initGenderTable();
    },

    initGenderTable() {
        if (DB.tableExists(TABLE_NAME_TO_GENDER)) {
            return;
        }
        const name_to_gender_json = require("./firstnames.json");
        console.log(name_to_gender_json);
        DB.createTableWithData(TABLE_NAME_TO_GENDER, name_to_gender_json);
        DB.commit();
    },

    /**
     * sets xls_upload_datetime to current time
     */
    setUploadTime() {
        this.xls_upload_datetime = new Date().toLocaleDateString('de-DE', constants.STATUS_DATE_FORMAT);
        window.localStorage.setItem(LOCALSTORAGE_LAST_UPLOAD, this.xls_upload_datetime);
        this.refreshStatus();
    },

    hasData() {
        return DB.tableExists(TABLE_SEARCH) && DB.queryAll(TABLE_SEARCH).length > 0;
    },

    search(params) {
        if (!this.hasData()) {
            alert("Keine Daten. Bitte xls hochladen");
        }

        if (params.length === 0) {
            return DB.queryAll(TABLE_SEARCH);
        } else {
            return DB.queryAll(TABLE_SEARCH, {
                query: row => {
                    for (const [key, value] of Object.entries(params)) {
                        if (!(row[key] + "").includes(value)) {
                            return false;
                        }
                    }
                    return true;
                }
            });
        }
    },

    getAnrede(vorname) {
        const result = DB.queryAll(TABLE_NAME_TO_GENDER, {
            query: {
                name: vorname
            },
            limit: 1
        });

        if (result.length === 0) {
            return constants.ANREDE_GAST;
        }

        return result[0].gender === 'M' ? constants.ANREDE_HERR : constants.ANREDE_FRAU;
    }
}