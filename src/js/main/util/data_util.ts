import constants from "./constants";

interface DeferredPromise {
    promise: Promise<any>,
    resolve: (value: any) => void
}

const utils = {
    generateDeferredPromise(): DeferredPromise {
        return (() => {
            let resolve;

            const promise = new Promise(resolvePromise => {
                resolve = resolvePromise;
            });

            return {
                promise: promise,
                resolve
            };
        })();
    },
    /**
     * 
     * @param {string} birthdate 
     * @param {string} date day of the age check
     * @returns {number} age
     */
    getAgeOnDate(birthdate: Date, date: Date): number {
        try {
            // if birthdate was 01.01.1970 then date would be ...?
            const ageDate = new Date(date.getTime() - birthdate.getTime());
            // get age by counting the years since 1970
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            return age;
        } catch (error) {
            console.log(`getAgeOnDate("${birthdate}", "${date}") threw an exception`);
            console.log(error.toString());
            alert(`Geburtsdatum oder Tag der Anreise sind ungültig.
Geburtsdatum: ${birthdate}
Anreise: ${date}`);
            return -1;
        }
    }
}


export default {

    getHotspotName: (apartment: string): string => {
        if (apartment.includes("Enzian") ||
            apartment.includes("Krokus")) {
            return "12 Enzian";
        }
        if (apartment.includes("Lavendel") ||
            apartment.includes("Lilien")) {
            return "22 Lavendel";
        }
        if (apartment.includes("Rosen")) {
            return "23 Rosen";
        }
        if (apartment.includes("Tulpen")) {
            return "24 Tulpen";
        }
        if (apartment.includes("Nelken")) {
            return "31 Nelken";
        }
        if (apartment.includes("Narzissen")) {
            return "32 Narzissen";
        }
        return null;
    },

    getVoucherDuration: (abreise: Date): string => {
        const lengthOfStay: number = Math.ceil((abreise.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) + 1; // abreise - heute + 1

        if (lengthOfStay < 0) {
            alert("ungültige Aufenthaltsdauer: Abreise - Anreise < 0");
            return null;
        }

        let daysValid = 7;

        if (lengthOfStay <= 7) {
            daysValid = 7;
        } else if (lengthOfStay <= 10) {
            daysValid = 10;
        } else if (lengthOfStay <= 14) {
            daysValid = 14;
        } else if (lengthOfStay <= 16) {
            daysValid = 16;
        } else if (lengthOfStay <= 22) {
            daysValid = 22;
        } else {
            daysValid = 40;
        }

        return `${daysValid} Tage`;
    },

    getVoucherComment: (table_data: any) => {
        return `${table_data.nachname} ${table_data.apartment} ${table_data.anreise} bis ${table_data.abreise}`;
    },

    /**
     * 
     * @param {Array<Date>} birthdates 
     * @param {Date} anreise 
     * @returns 
     */
    getNumberOfKeys: (birthdates: Array<Date> | null, anreise: Date): number => {
        if (!birthdates || birthdates.length === 0) {
            return 2;
        }

        let numberOfKeys = 0;
        birthdates.forEach(birthdate => {
            const age = utils.getAgeOnDate(birthdate, anreise);
            if (age >= 16) {
                numberOfKeys++;
            }
        });

        // enforce 2 key minimum
        if (numberOfKeys < 2) {
            return 2;
        }

        return numberOfKeys;
    },

    /**
     * @returns dd.MM.yyyy
     */
    formatDate(date: Date): string {
        return date.toLocaleDateString("de-DE");
    },

    clone(object: any): any {
        return JSON.parse(JSON.stringify(object));
    },

    readTextFile(file: Blob): Promise<string> {
        const reader = new FileReader()
        return new Promise((resolve, reject) => {
            reader.onload = event => resolve(event.target.result as string)
            reader.onerror = error => reject(error)
            reader.readAsText(file, "UTF-8")
        })
    }
};