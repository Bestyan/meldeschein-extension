// for webpack (css needs to be referenced to be packed)
import "../css/popup.css";

import XLSX from 'xlsx';
import Tabulator from 'tabulator-tables';
import mail from './mail_generator';
import db from './database';
import util from './data_utils';
import constants from './constants';

// dropdowns in popup
const COLUMNS_FILTER_REISE = ["anreise", "abreise"];
const COLUMNS_FILTER = ["nachname", "strasse", "plz", "ort", "apartment", "personen", "vermerk", "email"];

// Tabulator table
let result_table = null;

db.setup(refreshStatus);

/**
 * reads xls to json
 * @param {Event} e
 */
function handleFile(e) {
    setLoadingScreenVisible(true);
    let files = e.target.files,
        f = files[0];
    let reader = new FileReader();
    reader.onload = e => {
        let data = new Uint8Array(e.target.result);
        let workbook = XLSX.read(data, {
            type: 'array',
            cellDates: true
        });

        /*
            modify column names to not contain forbidden characters
        */
        let sheet = workbook.Sheets[workbook.SheetNames[0]];
        util.cleanColumnNames(sheet);
        /*
            hand over to database
        */
        let sheet_as_json = XLSX.utils.sheet_to_json(sheet);
        db.initDB(sheet_as_json);
        setLoadingScreenVisible(false);
    };
    reader.readAsArrayBuffer(f);
}

function refreshStatus() {
    const NO_DATA = "keine Daten";
    const status = document.getElementById("status");
    status.classList.remove("good", "bad");

    if (db.hasData()) {

        status.classList.add("good");
        status.innerHTML = `Daten vom ${db.xls_upload_datetime}`;

    } else{

        status.classList.add("bad");
        status.innerHTML = NO_DATA;
        return;
        
    }
}

function setupSearchDropDowns() {

    COLUMNS_FILTER_REISE.forEach(column => {
        let option = document.createElement("option");
        option.value = column;
        option.innerHTML = column;
        document.getElementById("search1").append(option);
    });
    COLUMNS_FILTER.forEach(column => {
        let option = document.createElement("option");
        option.value = column;
        option.innerHTML = column;
        document.getElementById("search2").append(option);
    });

    document.getElementById("search1_input").value = new Date().toISOString().substr(0, "yyyy-mm-dd".length);
    document.getElementById("date_plus_one").addEventListener("click", event => {
        document.getElementById("search1_input").stepUp(1);
    });
    document.getElementById("date_minus_one").addEventListener("click", event => {
        document.getElementById("search1_input").stepUp(-1);
    });

}

function searchDB(event) {

    event.preventDefault();
    let searchParams = {};

    let search1 = document.getElementById("search1_input").value;
    if (search1.length > 0) {
        searchParams[document.getElementById("search1").value] = new Date(search1).toLocaleDateString("de-DE", constants.SEARCH_RESULT_DATE_FORMAT);
    }

    let search2 = document.getElementById("search2_input").value;
    if (search2.length > 0) {
        searchParams[document.getElementById("search2").value] = search2;
    }

    // query DB
    let rows = db.search(searchParams);

    console.log(rows);
    result_table = new Tabulator("#search_results", {
        layout: "fitDataStretch",
        data: rows,
        selectableRollingSelection: true,
        selectable: 1,
        pagination: "local",
        paginationSize: 10,
        columns: [{
                title: "Vorname",
                field: "vorname"
            },
            {
                title: "Nachname",
                field: "nachname"
            },
            {
                title: "Anreise",
                field: "anreise"
            },
            {
                title: "Abreise",
                field: "abreise"
            },
            {
                title: "Apartment",
                field: "apartment"
            },
            {
                title: "Personen",
                field: "personen"
            },
            {
                title: "Vermerk",
                field: "vermerk"
            }
        ]
    });
}

function generateMail() {
    if (result_table == null) {
        alert("keine Tabellenzeile ausgewählt");
        return;
    }

    let data = result_table.getSelectedData()[0];
    if (data == null) {
        alert("keine Tabellenzeile ausgewählt");
        return;
    }

    if (data.email.endsWith("booking.com") ||
        data.email.endsWith("tomas.travel")) {
        alert(`Buchungsportal-Email erkannt: ${data.email}
            Mail wird nicht generiert.`);
        return;
    }

    data.anrede = document.getElementById('anrede').value;
    const isFirstVisit = document.getElementById('is_first_visit').value == 'true';

    mail.generate(data, isFirstVisit);
}

function setLoadingScreenVisible(visible) {
    const loadingScreen = document.getElementById('loading_screen');
    loadingScreen.classList.remove('hide', 'flex');
    if (visible) {
        loadingScreen.classList.add('flex');
    } else {
        loadingScreen.classList.add('hide');
    }
}

function buildUI() {
    refreshStatus();

    // Button "Daten löschen"
    document.getElementById('delete').addEventListener('click', event => {
        db.resetDB();
        alert("Daten gelöscht");
        refreshStatus();
    });

    // Button "Choose file"
    document.getElementById('upload').addEventListener('change', handleFile, false);

    // Suchparameter (Dropdowns)
    setupSearchDropDowns();

    // Button/Form "suchen"
    document.getElementById('search').addEventListener('submit', searchDB);

    // Button "Meldeschein ausfüllen"
    document.getElementById('meldeschein_fill').addEventListener("click", event => {
        if (result_table == null) {
            alert("keine Tabellenzeile ausgewählt");
            return;
        }

        let data = result_table.getSelectedData()[0];
        if (data == null) {
            alert("keine Tabellenzeile ausgewählt");
            return;
        }
        console.log(data);
        let form_data = {
            "anreise_input": data.anreise,
            "abreise_input": data.abreise,
            "nachname0": data.nachname, //Nachname Gast
            "nachname1_input": data.nachname, // Nachname Begl. 1
            "vorname0": data.vorname,
            "strasse0": data.strasse || data.anschrift,
            "plz0_input": data.plz,
            "ort0_input": data.ort
        };

        const anrede = db.getAnrede(data.vorname);
        form_data.anrede0 = anrede;
        // Anrede der Begleitperson != Anrede des Buchenden
        form_data.anrede1 = anrede === constants.ANREDE_GAST ? constants.ANREDE_GAST : anrede === constants.ANREDE_HERR ? constants.ANREDE_FRAU : constants.ANREDE_HERR;


        if (data.land !== "") {
            form_data.land0_input = data.land; // Land in Adresse (vorausgefüllt Deutschland)
            form_data.staat0_input = data.land; // Staatsangehörigkeit Gast
            form_data.staat1_input = data.land; // Staatsangehörigkeit Begl. 1
        }

        // send data to content script fill_meldeschein.js
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                data: form_data
            });
        });
    });

    // Button "WLAN Voucher ausfüllen"
    document.getElementById('wlan_voucher_fill').addEventListener('click', event => {
        if (result_table == null) {
            alert("keine Tabellenzeile ausgewählt");
            return;
        }

        let data = result_table.getSelectedData()[0];
        if (data == null) {
            alert("keine Tabellenzeile ausgewählt");
            return;
        }

        // message to content script fill_vlan_voucher.js
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                data: {
                    hotspot: util.getHotspot(data.apartment),
                    gueltigkeit: util.getVoucherGueltigkeit(data.abreise),
                    kommentar: util.getKommentar(data)
                }
            });
        });
    });

    // Button "TManager ausfüllen"
    document.getElementById('tmanager_fill').addEventListener('click', event => {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                hello: 'go do your stuff' // message content doesn't matter at all here, just sending a message is important
            });
        });
    });

    // Button [Mail] "erstellen"
    document.getElementById('generate').addEventListener('click', generateMail, false);

    // Visibility of Buttons
    chrome.tabs.query({
            currentWindow: true,
            active: true
        },
        tabs => {
            let url = tabs[0].url;

            let meldeschein_fill_button = document.getElementById('meldeschein_fill');
            let wlan_voucher_fill_button = document.getElementById('wlan_voucher_fill');
            let tmanager_fill_button = document.getElementById('tmanager_fill');
            meldeschein_fill_button.classList.remove('hide');
            wlan_voucher_fill_button.classList.remove('hide');
            tmanager_fill_button.classList.remove('hide');

            // no url entered
            if (url == null || url == undefined) {
                url = "";
            }

            if (!url.toString().includes('emeldeschein.de')) {
                meldeschein_fill_button.classList.add('hide');
            }

            if (!url.toString().includes('192.168.1.254:44444') &&
                !url.toString().includes('file://')) {
                wlan_voucher_fill_button.classList.add('hide');
            }

            if (!url.toString().includes('tmanager.tomas-travel.com')) {
                tmanager_fill_button.classList.add('hide');
            }
        });
}

buildUI();