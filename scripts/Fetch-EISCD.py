#!/home/mintly/Documents/.venv/bin/python

# Call playwright and download the EISCD# Then upload to AWS S3
# To setup:# pip3 install -r requirements.txt
# playwright install
import os
import time
import hashlib
import logging
import boto3
import pyotp
from playwright.sync_api import sync_playwright

from dotenv import load_dotenv

logger = logging.getLogger(__name__)
logging.basicConfig(filename='eiscd.log', encoding='utf-8', format='%(asctime)s %(message)s', level=logging.INFO)

# Playwright function to download file

def download_file(url, contact_id, password, totp_secret, download_path, download_xml_path):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(90000)
        # Go to the URL
        page.goto(url, wait_until="networkidle")

        # Type in the login credentials
        page.fill("#contactId", contact_id)
        page.fill("#password", password)
        page.evaluate("document.querySelector('#password').blur()")

        # Click the submit button
        page.wait_for_selector("button[type=submit]")
        page.evaluate_handle("document.querySelector('button[type=submit]').click()")
        page.wait_for_load_state("domcontentloaded")

        # Enter the TOTP code for the mandatory 2FA step.
        # #otp is the native <input> inside the <psw-textbox> Angular
        # component (formcontrolname="otp" lives on the wrapper, not the
        # input itself - confirmed against the live MFA screen). The form
        # only syncs/validates the control on blur, so blur it explicitly
        # after filling or the "must be 6 numeric digits" error persists.
        totp_selector = "#otp"
        page.wait_for_selector(totp_selector)
        code = pyotp.TOTP(totp_secret, digest=hashlib.sha256).now()  # generate right before filling, codes rotate every 30s
        page.fill(totp_selector, code)
        page.locator(totp_selector).blur()
        page.wait_for_selector("button[type=submit]")
        page.evaluate_handle("document.querySelector('button[type=submit]').click()")
        page.wait_for_load_state("domcontentloaded")
        logger.info("Submitted TOTP code")

        # Wait for navigation and click the necessary elements to reach the TXT download
        page.wait_for_selector("nav")
        page.locator("nav cds-sidenav-item a", has_text="Reports").click()
        page.wait_for_selector(".alnk")
        page.evaluate("document.querySelector('.alnk').click()")
        logger.info("Found reports page!")
        page.wait_for_selector("input[role=combobox]")
        page.evaluate("document.querySelector('input[role=combobox]').click()")
        page.wait_for_selector("li[role=option]")
        page.evaluate("document.querySelectorAll('li[role=option]')[0].click()")
        logger.info("Found TXT report!")
        page.wait_for_selector("table")
        
        # Expecting the download 
        with page.expect_download() as download_info:
            page.evaluate("document.querySelectorAll('psw-tooltip-download')[1].click()")
            download = download_info.value
            download.save_as(download_path)
            logger.info("TXT File saved")
        
        # Now download the XML report
        page.wait_for_selector("input[role=combobox]")
        page.evaluate("document.querySelector('input[role=combobox]').click()")
        page.wait_for_selector("li[role=option]")
        page.evaluate("document.querySelectorAll('li[role=option]')[1].click()")
        logger.info("Found XML report!")
        page.wait_for_selector("table")
        
        # Expecting the download 
        with page.expect_download() as download_info:
            page.evaluate("document.querySelectorAll('psw-tooltip-download')[1].click()")
            download = download_info.value
            download.save_as(download_xml_path)
            logger.info("File saved")
            
        context.close()
        browser.close()
        
# Boto3 function to upload file to S3

def upload_file_to_s3(file_path, bucket_name, s3_key):
    s3 = boto3.client('s3')
    s3.upload_file(file_path, bucket_name, s3_key)
    logger.info(f"File uploaded successfully to {bucket_name}/{s3_key}")

def send_notification(message, status='Success'):
    sns = boto3.client('sns', region_name='eu-west-2')
    sns.publish(
        TopicArn='arn:aws:sns:eu-west-2:338725913343:EISCD-notifications',
        Message=message,
        Subject=f'EISCD Updated: {status}'
        )

# Main function
def main():
    load_dotenv()

    # Define your variables
    url = os.getenv('DOWNLOAD_URL')
    contact_id = os.getenv('CONTACT_ID')
    password = os.getenv('PASSWORD')
    totp_secret = os.getenv('TOTP_SECRET')
    download_path = "/home/mintly/Downloads/report.zip"
    download_xml_path = "/home/mintly/Downloads/report_xml.zip"

    # Path where the file will be downloaded
    bucket_name = os.getenv('S3_BUCKET_NAME')
    s3_key = "report.zip" # S3 key for the uploaded file
    s3_xml_key = "report_xml.zip"
    # Download the file
    try:
        download_file(url, contact_id, password, totp_secret, download_path, download_xml_path)
         # Upload the file to S3 
        upload_file_to_s3(download_path, bucket_name, s3_key)
        upload_file_to_s3(download_xml_path, bucket_name, s3_xml_key)
        # Clean up the downloaded file
        if os.path.exists(download_path):
            os.remove(download_path)
        if os.path.exists(download_xml_path):
            os.remove(download_xml_path)
            
        send_notification('EISCD Loaded successfully')
        print('Process completed successfully')
    except Exception as e:
        send_notification('EISCD Loaded problem', "FAIL")
        logger.error(f"Error processing file: {e}")
        
if __name__ == "__main__":
    main()
